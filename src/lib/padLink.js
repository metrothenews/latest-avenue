// The live link between /experience (the "screen") and /experience/controller (the "pad").
//
// The two pages talk straight to each other over a WebRTC data channel, so a stick movement
// reaches the screen in a few milliseconds and nothing is sent through the database while
// playing. The database is only used to introduce them: the screen saves an "offer" under its
// pairing code, the pad reads it and saves an "answer" (firestore.rules: pads/{code}).
// If the link drops, the screen makes a new offer under the same code and the pad picks it up.
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import './firebase.js'
import { db } from './team.js'

const PADS = 'pads'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O or 1/I to mix up
const SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

export const CODE_LENGTH = 5
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(CODE_LENGTH)), (n) => ALPHABET[n % ALPHABET.length]).join('')
export const cleanCode = (text) => (text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)

// The offer or answer once the browser has found the ways it can be reached (or after 3 seconds).
function described(pc) {
  return new Promise((resolve) => {
    const done = () => resolve(pc.localDescription.sdp)
    if (pc.iceGatheringState === 'complete') return done()
    const timer = setTimeout(done, 3000)
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(timer); done() } })
  })
}

// The screen's side. onMessage(object) for everything the pad sends; onState('waiting' |
// 'connected'). Returns stop().
export function hostPad(code, onMessage, onState) {
  let pc = null
  let stopped = false
  let stopWatching = () => {}

  async function offer() {
    if (stopped) return
    stopWatching()
    pc?.close()
    onState('waiting')
    const mine = (pc = new RTCPeerConnection(SERVERS))
    const channel = mine.createDataChannel('pad')
    channel.onopen = () => mine === pc && onState('connected')
    channel.onmessage = (e) => { try { onMessage(JSON.parse(e.data)) } catch { /* not ours */ } }
    const again = () => { if (mine === pc && !stopped) offer() }
    channel.onclose = again
    mine.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(mine.connectionState)) again() }
    await mine.setLocalDescription(await mine.createOffer())
    const sdp = await described(mine)
    if (mine !== pc || stopped) return
    await setDoc(doc(db, PADS, code), { offer: sdp, at: Date.now() })
    stopWatching = onSnapshot(doc(db, PADS, code), (snap) => {
      const data = snap.data()
      if (mine !== pc || !data?.answer || data.offer !== sdp || mine.signalingState !== 'have-local-offer') return
      mine.setRemoteDescription({ type: 'answer', sdp: data.answer }).catch(() => {})
    }, () => {})
  }
  offer().catch(() => onState('failed'))

  return () => { stopped = true; stopWatching(); pc?.close() }
}

// The pad's side. onState('connecting' | 'connected' | 'unknown' (no screen has that code) |
// 'failed'). Returns { send(object), stop() }.
export function joinPad(code, onState) {
  let pc = null
  let channel = null
  let answered = ''
  let stopped = false
  onState('connecting')

  async function answer(sdp) {
    answered = sdp
    pc?.close()
    channel = null
    onState('connecting')
    const mine = (pc = new RTCPeerConnection(SERVERS))
    mine.ondatachannel = (e) => {
      channel = e.channel
      channel.onopen = () => mine === pc && onState('connected')
      channel.onclose = () => mine === pc && onState('connecting') // the screen will offer again
    }
    await mine.setRemoteDescription({ type: 'offer', sdp })
    await mine.setLocalDescription(await mine.createAnswer())
    const reply = await described(mine)
    if (mine !== pc || stopped) return
    await updateDoc(doc(db, PADS, code), { answer: reply })
  }

  const ref = doc(db, PADS, code)
  getDoc(ref).then((snap) => { if (!snap.exists() && !stopped) onState('unknown') }, () => onState('failed'))
  const stopWatching = onSnapshot(ref, (snap) => {
    const data = snap.data()
    if (data?.offer && data.offer !== answered && !data.answer) answer(data.offer).catch(() => onState('failed'))
  }, () => onState('failed'))

  return {
    send(message) { if (channel?.readyState === 'open') channel.send(JSON.stringify(message)) },
    stop() { stopped = true; stopWatching(); pc?.close() },
  }
}
