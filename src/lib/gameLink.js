// The live link for ALIBI.EXE, through the Realtime Database (the same one the /experience
// controller uses). The big screen runs the game; phones only send their own answer and vote.
//
// Stored at games/{code} (database.rules.json), `code` being the room code on the big screen:
//   host            when the screen opened the room (everything is removed when its page closes)
//   phase           lobby | write1 | vote1 | cut | write2 | vote2 | result
//   endsAt          when the current step's timer runs out (the database's clock, in ms)
//   game            a counter that goes up with each new game in the room
//   players/{seat}  true while that phone is connected
//   answers/{round}/{seat}   { text, at }
//   ballot/{round}/{key}     the round's answers, shuffled, keyed n1, n2, ... (no author)
//   authors/{round}/{key}    the seat that wrote that answer (to refuse votes for yourself)
//   votes/{round}/{seat}     the key that seat picked
//   tally/{round}/{key}      the final count for each answer, once the round's voting has closed
//   finalists/{seat}         true for the seats that play round 2
//   result          { key, text, count, winner } or { none: true }
import { getApp } from 'firebase/app'
import { get, getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set, update } from 'firebase/database'
import './firebase.js'
import { databaseURL } from '../data/firebase.js'

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I or O
export const CODE_LENGTH = 4
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(CODE_LENGTH)), (n) => LETTERS[n % LETTERS.length]).join('')
export const cleanCode = (text) => (text ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, CODE_LENGTH)

const db = getDatabase(getApp(), databaseURL)
const at = (code, path = '') => ref(db, `games/${code}${path && `/${path}`}`)

// How far this device's clock is from the database's, kept up to date: now() is the shared time.
let offset = 0
onValue(ref(db, '.info/serverTimeOffset'), (snap) => { offset = Number(snap.val()) || 0 })
export const now = () => Date.now() + offset

// This phone's seat: a random ID kept in its browser, so a refresh comes back as the same player.
export function mySeat() {
  const fresh = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (n) => 'abcdefghijklmnopqrstuvwxyz0123456789'[n % 36]).join('')
  try {
    const saved = localStorage.getItem('alibi-seat')
    if (/^[a-z0-9]{12}$/.test(saved ?? '')) return saved
    const seat = fresh()
    localStorage.setItem('alibi-seat', seat)
    return seat
  } catch {
    return fresh() // private window: a seat for this visit only
  }
}

// --- The big screen ---

// Opens a room and watches all of it: onGame(everything under games/{code}, or null).
// Returns { change(fields), stop() }; `change` writes several fields at once (null removes one).
export function openGame(code, onGame, onError) {
  onDisconnect(at(code)).remove().catch(() => {})
  set(at(code), { host: serverTimestamp(), phase: 'lobby', game: 1 }).catch(onError)
  const stop = onValue(at(code), (snap) => onGame(snap.val()), onError)
  return {
    change: (fields) => update(at(code), fields),
    stop: () => { stop(); remove(at(code)).catch(() => {}) },
  }
}

// --- A phone ---

// Joins a room. onState gets, whenever anything changes:
//   { status: 'joining' | 'in' | 'unknown' | 'full' | 'over' | 'failed', phase, endsAt, game,
//     ballot: { 1, 2 }, authors: { 1, 2 }, finalists, result, answer: { 1, 2 }, vote: { 1, 2 } }
// Returns { answer(round, text), vote(round, key), stop() }.
export function joinGame(code, seat, maxPlayers, onState) {
  const state = { status: 'joining', phase: null, endsAt: 0, game: 0, ballot: {}, authors: {}, finalists: {}, result: null, answer: {}, vote: {} }
  const tell = () => onState({ ...state, ballot: { ...state.ballot }, authors: { ...state.authors }, answer: { ...state.answer }, vote: { ...state.vote } })
  const stops = []
  let stopped = false
  let online = false
  let hosted = null // null until we've heard

  function sit() {
    if (stopped || !online || !hosted || state.status === 'full') return
    onDisconnect(at(code, `players/${seat}`)).remove().catch(() => {})
    set(at(code, `players/${seat}`), true).then(() => { if (!stopped) { state.status = 'in'; tell() } }, () => { state.status = 'failed'; tell() })
  }
  const watch = (path, apply) => stops.push(onValue(at(code, path), (snap) => { apply(snap.val()); tell() }, () => {}))

  get(at(code)).then((snap) => {
    if (stopped) return
    const room = snap.val()
    if (!room?.host) { state.status = 'unknown'; return tell() }
    const players = Object.keys(room.players ?? {})
    if (!players.includes(seat) && players.length >= maxPlayers) { state.status = 'full'; return tell() }
    stops.push(onValue(ref(db, '.info/connected'), (s) => { online = Boolean(s.val()); sit() }))
    stops.push(onValue(at(code, 'host'), (s) => {
      const was = hosted
      hosted = s.exists()
      if (was && !hosted) { state.status = 'over'; tell() } else sit()
    }, () => { state.status = 'failed'; tell() }))
    watch('phase', (v) => { state.phase = v })
    watch('endsAt', (v) => { state.endsAt = Number(v) || 0 })
    watch('game', (v) => { state.game = Number(v) || 0 })
    watch('finalists', (v) => { state.finalists = v ?? {} })
    watch('result', (v) => { state.result = v })
    for (const round of [1, 2]) {
      watch(`ballot/${round}`, (v) => { state.ballot[round] = v ?? null })
      watch(`authors/${round}`, (v) => { state.authors[round] = v ?? null })
      watch(`answers/${round}/${seat}`, (v) => { state.answer[round] = v?.text ?? null })
      watch(`votes/${round}/${seat}`, (v) => { state.vote[round] = v ?? null })
    }
  }, () => { state.status = 'failed'; tell() })

  return {
    answer: (round, text) => set(at(code, `answers/${round}/${seat}`), { text, at: serverTimestamp() }),
    vote: (round, key) => set(at(code, `votes/${round}/${seat}`), key),
    stop() {
      stopped = true
      stops.forEach((stop) => stop())
      if (state.status === 'in') remove(at(code, `players/${seat}`)).catch(() => {})
    },
  }
}
