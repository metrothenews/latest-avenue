// The live link around one /experience screen, through Firebase's Realtime Database: phones at
// /experience/controller (the "pads"), and the owner at /admin/experience (the "admin"), who can
// see who is connected, decide who has the controls, take them over, and run a story.
//
// Stored at pads/{code} (database.rules.json), `code` being the pairing code the screen shows:
//   host             when the screen opened it
//   players/{seat}   when that phone joined (removed when its page closes)
//   inputs/{seat}    { x, y, a, b }: that phone's stick (-1..1 each way, up is +y) and how many
//                    times it has pressed A and X ("b"); the screen acts when a count goes up
//   first            the seat that gets the controls unless the admin says otherwise (the
//                    party game's winner, when the screen was opened from the game)
//   names/{seat}     that player's name, when they gave one in the game
//   crowd/{seat}     { k, c }: the last thing a phone without the controls pressed on its
//                    audience pad (a nudge or a reaction), and a count that goes up each time
//   status           what the screen is doing, for the admin: { viewing, spot, page, count, locked }
//   show             written only by the owner (signed in):
//     driver         whose controls count: a seat, 'admin', or '' for whoever joined first
//     before         who had them before the admin took over (to hand them back)
//     input          the admin's own { x, y, a, b }
//     removed/{seat} true for a phone the admin has removed
//     mute           true to ignore the audience pads
//     hints, hintNow false to switch the "look this way" prompt off; a count that shows it now
//     story          { on, at, phone, started, skip, chapters: [{ title, spot, deck }] }
import { getApp } from 'firebase/app'
import { getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set, update } from 'firebase/database'
import './firebase.js'
import { databaseURL } from '../data/firebase.js'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O or 1/I to mix up
export const CODE_LENGTH = 5
export const ADMIN = 'admin'
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(CODE_LENGTH)), (n) => ALPHABET[n % ALPHABET.length]).join('')
export const cleanCode = (text) => (text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)

const db = getDatabase(getApp(), databaseURL)
const at = (code, path = '') => ref(db, `pads/${code}${path && `/${path}`}`)

// This phone's seat: a random ID kept in its browser, so a refresh comes back as the same player.
export function mySeat() {
  const fresh = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (n) => 'abcdefghijklmnopqrstuvwxyz0123456789'[n % 36]).join('')
  try {
    const saved = localStorage.getItem('pad-seat')
    if (/^[a-z0-9]{12}$/.test(saved ?? '')) return saved
    const seat = fresh()
    localStorage.setItem('pad-seat', seat)
    return seat
  } catch {
    return fresh() // private window: a seat for this visit only
  }
}

// The seats that are connected and not removed, in the order they joined.
export const seatsOf = (room) => Object.entries(room?.players ?? {})
  .filter(([seat]) => !room?.show?.removed?.[seat])
  .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
  .map(([seat]) => seat)

// Whose controls count right now: the admin while a story's chapter is being presented, else
// whoever the admin chose, else the game's winner, else the first phone to have joined.
export function driverOf(room) {
  const show = room?.show
  if (show?.story?.on && room?.status?.viewing) return ADMIN
  if (show?.driver === ADMIN) return ADMIN
  const seats = seatsOf(room)
  if (seats.includes(show?.driver)) return show.driver
  return seats.includes(room?.first) ? room.first : seats[0] ?? null
}

// Turns a stream of { x, y, a, b } into messages, one source at a time: the stick as it is, and
// a 'down' each time a press count goes up.
function reader(onMessage) {
  const seen = new Map() // source → { a, x } counts last seen
  return (source, input) => {
    if (!input) { seen.delete(source); return onMessage(source, { t: 'stick', x: 0, y: 0 }) }
    onMessage(source, { t: 'stick', x: Number(input.x) || 0, y: Number(input.y) || 0 })
    const counts = { a: Number(input.a) || 0, x: Number(input.b) || 0 }
    const before = seen.get(source)
    if (before) for (const b of ['a', 'x']) if (counts[b] > before[b]) onMessage(source, { t: 'down', b })
    seen.set(source, counts)
  }
}

// --- The screen ---
// onRoom(everything under pads/{code}) whenever anything changes; onMessage(source, message) for
// each phone's and the admin's stick and presses (`source` is a seat or ADMIN; the screen decides
// whose count with driverOf). onState('waiting' | 'connected' | 'failed').
// Returns { status(fields), stop() }.
export function hostPad(code, { onRoom = () => {}, onMessage, onState, first = '' }) {
  const read = reader(onMessage)
  let known = new Set()
  onState('waiting')
  const mine = ['host', 'players', 'inputs', 'status', 'first', 'names', 'crowd']
  for (const path of mine) onDisconnect(at(code, path)).remove().catch(() => {})
  set(at(code, 'host'), serverTimestamp()).catch(() => onState('failed'))
  if (first) set(at(code, 'first'), first).catch(() => {})
  const stop = onValue(at(code), (snap) => {
    const room = snap.val() ?? {}
    onRoom(room)
    onState(seatsOf(room).length || room.show?.driver === ADMIN ? 'connected' : 'waiting')
    const sources = new Set([...Object.keys(room.inputs ?? {}), ...(room.show?.input ? [ADMIN] : [])])
    for (const source of known) if (!sources.has(source)) read(source, null)
    for (const source of sources) read(source, source === ADMIN ? room.show.input : room.inputs[source])
    known = sources
  }, () => onState('failed'))
  return {
    status: (fields) => update(at(code, 'status'), fields).catch(() => {}),
    stop: () => { stop(); for (const path of mine) remove(at(code, path)).catch(() => {}) },
  }
}

// --- A phone ---
// onState({ link: 'connecting' | 'connected' | 'unknown' (no screen is showing that code) |
// 'removed' | 'failed', driving: this phone has the controls, presenting: the presenter has them
// for now, muted: the admin has switched the audience pads off }).
// Returns { stick(x, y), press('a' | 'x'), crowd(kind), stop() }.
export function joinPad(code, seat, onState, name = '') {
  const input = { x: 0, y: 0, a: 0, b: 0 }
  let live = false // a screen is there and we are connected to the database
  let online = false
  let room = null
  let pressed = 0 // audience pad presses
  onState({ link: 'connecting', driving: false, presenting: false, muted: false })

  function settle() {
    if (room === null) return
    const hosted = Boolean(room.host)
    const removed = Boolean(room.show?.removed?.[seat])
    const now = hosted && online && !removed
    if (now && !live) {
      // (Re)join: say we're here, and clear ourselves away if this page closes or drops.
      onDisconnect(at(code, `players/${seat}`)).remove().catch(() => {})
      onDisconnect(at(code, `inputs/${seat}`)).remove().catch(() => {})
      set(at(code, `players/${seat}`), room.players?.[seat] ?? serverTimestamp()).catch(() => {})
      set(at(code, `inputs/${seat}`), input).catch(() => {})
      if (name) set(at(code, `names/${seat}`), name.slice(0, 20)).catch(() => {})
    }
    if (!now && live) { remove(at(code, `players/${seat}`)).catch(() => {}); remove(at(code, `inputs/${seat}`)).catch(() => {}) }
    live = now
    const driver = driverOf(room)
    onState({
      link: removed ? 'removed' : now && room.players?.[seat] ? 'connected' : online && !hosted ? 'unknown' : 'connecting',
      driving: driver === seat,
      presenting: driver === ADMIN,
      muted: Boolean(room.show?.mute),
    })
  }
  const stops = [
    onValue(ref(db, '.info/connected'), (snap) => { online = Boolean(snap.val()); settle() }),
    onValue(at(code), (snap) => { room = snap.val() ?? {}; settle() }, () => onState({ link: 'failed', driving: false, presenting: false, muted: false })),
  ]

  return {
    stick(x, y) { input.x = x; input.y = y; if (live) update(at(code, `inputs/${seat}`), { x, y }).catch(() => {}) },
    press(button) {
      const key = button === 'a' ? 'a' : 'b'
      input[key] += 1
      if (live) update(at(code, `inputs/${seat}`), { [key]: input[key] }).catch(() => {})
    },
    // The audience pad: 'l' | 'r' | 'u' | 'd' (a nudge) or a reaction's name.
    crowd(kind) { if (live) set(at(code, `crowd/${seat}`), { k: kind, c: ++pressed }).catch(() => {}) },
    stop() {
      stops.forEach((stop) => stop())
      if (live) { remove(at(code, `players/${seat}`)).catch(() => {}); remove(at(code, `inputs/${seat}`)).catch(() => {}) }
    },
  }
}

// --- The admin (signed in as the owner) ---
// onRoom(everything under pads/{code}; `host` is missing while no screen is showing that code).
// Returns { show(fields) (writes under show/, null removes), stick(x, y), press('a' | 'x'), stop() }.
export function adminPad(code, onRoom, onError = () => {}) {
  const input = { x: 0, y: 0, a: 0, b: 0 }
  const send = () => set(at(code, 'show/input'), input).catch(onError)
  const stop = onValue(at(code), (snap) => onRoom(snap.val() ?? {}), onError)
  onDisconnect(at(code, 'show/input')).remove().catch(() => {})
  return {
    show: (fields) => update(at(code, 'show'), fields).catch(onError),
    stick(x, y) { input.x = x; input.y = y; send() },
    press(button) { input[button === 'a' ? 'a' : 'b'] += 1; send() },
    stop() { stop(); remove(at(code, 'show/input')).catch(() => {}) },
  }
}
