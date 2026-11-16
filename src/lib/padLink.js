// The live link between /experience (the "screen") and /experience/controller (the "pad"),
// through Firebase's Realtime Database: the pad writes what its stick and buttons are doing, and
// the screen, which is listening to the same spot, gets each change as it happens.
//
// Stored at pads/{code} (database.rules.json), where `code` is the pairing code the screen shows:
//   host:  when the screen opened it (removed when the screen's page closes, with everything else)
//   pad:   true while a controller is connected (removed when its page closes)
//   input: { x, y, a, b }: the stick, -1..1 each way (up is +y), and how many times A and X
//          ("b") have been pressed (the screen acts when a count goes up)
import { getApps, initializeApp } from 'firebase/app'
import { getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set, update } from 'firebase/database'
import { databaseURL, firebaseConfig } from '../data/firebase.js'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O or 1/I to mix up
export const CODE_LENGTH = 5
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(CODE_LENGTH)), (n) => ALPHABET[n % ALPHABET.length]).join('')

// Nobody signs in here, so this starts Firebase without the sign-in parts (lib/firebase.js adds
// those, on the pages that need them, to the same app).
const db = getDatabase(getApps()[0] ?? initializeApp(firebaseConfig), databaseURL)
const at = (code, path = '') => ref(db, `pads/${code}${path && `/${path}`}`)

// The screen's side. onMessage({ t: 'stick', x, y } | { t: 'down', b: 'a' | 'x' }) for what the
// pad does; onState('waiting' | 'connected' | 'failed'). Returns stop().
export function hostPad(code, onMessage, onState) {
  let presses = null // the last counts seen, so only new presses count
  onState('waiting')
  onDisconnect(at(code)).remove().catch(() => {})
  set(at(code), { host: serverTimestamp() }).catch(() => onState('failed'))
  const stops = [
    onValue(at(code, 'pad'), (snap) => onState(snap.val() ? 'connected' : 'waiting'), () => onState('failed')),
    onValue(at(code, 'input'), (snap) => {
      const input = snap.val()
      if (!input) { presses = null; return onMessage({ t: 'stick', x: 0, y: 0 }) }
      onMessage({ t: 'stick', x: Number(input.x) || 0, y: Number(input.y) || 0 })
      const counts = { a: Number(input.a) || 0, x: Number(input.b) || 0 }
      if (presses) for (const b of ['a', 'x']) if (counts[b] > presses[b]) onMessage({ t: 'down', b })
      presses = counts
    }, () => {}),
  ]
  return () => { stops.forEach((stop) => stop()); remove(at(code)).catch(() => {}) }
}

// The pad's side. onState('connecting' | 'connected' | 'unknown' (no screen is showing that
// code) | 'failed'). Returns { stick(x, y), press('a' | 'x'), stop() }.
export function joinPad(code, onState) {
  const input = { x: 0, y: 0, a: 0, b: 0 }
  let live = false // a screen is there and we are connected to the database
  let hosted = false
  let online = false
  onState('connecting')

  function settle() {
    const now = hosted && online
    if (now && !live) {
      // (Re)join: say we're here, and clear ourselves away if this page closes or drops.
      onDisconnect(at(code, 'pad')).remove().catch(() => {})
      onDisconnect(at(code, 'input')).update({ x: 0, y: 0 }).catch(() => {})
      set(at(code, 'pad'), true).catch(() => onState('failed'))
      update(at(code, 'input'), input).catch(() => {})
    }
    live = now
    onState(now ? 'connected' : online && !hosted ? 'unknown' : 'connecting')
  }
  let heard = false
  const stops = [
    onValue(ref(db, '.info/connected'), (snap) => { online = Boolean(snap.val()); if (heard || !online) settle() }),
    onValue(at(code, 'host'), (snap) => { heard = true; hosted = snap.exists(); settle() }, () => onState('failed')),
  ]

  return {
    stick(x, y) { input.x = x; input.y = y; if (live) update(at(code, 'input'), { x, y }).catch(() => {}) },
    press(button) {
      const key = button === 'a' ? 'a' : 'b'
      input[key] += 1
      if (live) update(at(code, 'input'), { [key]: input[key] }).catch(() => {})
    },
    stop() {
      stops.forEach((stop) => stop())
      if (live) { remove(at(code, 'pad')).catch(() => {}); update(at(code, 'input'), { x: 0, y: 0 }).catch(() => {}) }
    },
  }
}
