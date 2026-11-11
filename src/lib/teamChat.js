// Team messaging on Firestore (see firestore.rules):
// - chats/team: the shared chat. chats/{a}|{b}: a private chat between two members (emails in order).
//   A chat document holds { members (private chats only), lastAt, lastFrom }.
// - chats/{id}/messages/{id}: { from (email), text, at }.
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { db, deadline } from './team.js'

export const TEAM_CHAT = 'team'
export const MAX_MESSAGE = 4000
const SHOWN = 200 // newest messages loaded per chat

const pair = (a, b) => [a, b].sort()
export const directChatId = (a, b) => pair(a, b).join('|')

// Calls onChange({ [chatId]: { lastAt (ms), lastFrom } }) for the team chat and every private chat `email` is in.
// Returns a function that stops watching.
export function watchChats(email, onChange, onError) {
  const chats = { team: {}, direct: {} }
  const emit = () => onChange({ ...chats.direct, ...chats.team })
  const summary = (d) => ({ lastAt: d.data({ serverTimestamps: 'estimate' }).lastAt?.toMillis() ?? 0, lastFrom: d.data().lastFrom })
  // A chat this browser has just created is left out until the server has saved it: its messages
  // can't be read before then (the rules look the chat up), so nothing should start watching it yet.
  const saved = (d) => d.exists() && !d.metadata.hasPendingWrites
  const live = { includeMetadataChanges: true }
  const stops = [
    onSnapshot(doc(db, 'chats', TEAM_CHAT), live, (d) => {
      chats.team = saved(d) ? { [TEAM_CHAT]: summary(d) } : chats.team
      emit()
    }, onError),
    onSnapshot(query(collection(db, 'chats'), where('members', 'array-contains', email)), live, (snap) => {
      chats.direct = Object.fromEntries(snap.docs.filter((d) => saved(d) || chats.direct[d.id]).map((d) => [d.id, summary(d)]))
      emit()
    }, onError),
  ]
  return () => stops.forEach((stop) => stop())
}

// Calls onChange([{ id, from, text, at (Date) }]) oldest first, live. Returns a function that stops watching.
export function watchMessages(chatId, onChange, onError) {
  const newest = query(collection(db, 'chats', chatId, 'messages'), orderBy('at', 'desc'), limit(SHOWN))
  return onSnapshot(newest, (snap) => {
    onChange(snap.docs.map((d) => {
      const m = d.data({ serverTimestamps: 'estimate' })
      return { id: d.id, from: m.from, text: m.text, at: m.at.toDate() }
    }).reverse())
  }, onError)
}

// Sends `text` from `from`. For a private chat pass the other person's email as `to`.
export function sendMessage({ from, to, text }) {
  const chatId = to ? directChatId(from, to) : TEAM_CHAT
  const chat = doc(db, 'chats', chatId)
  const batch = writeBatch(db)
  batch.set(chat, { ...(to && { members: pair(from, to) }), lastAt: serverTimestamp(), lastFrom: from }, { merge: true })
  batch.set(doc(collection(chat, 'messages')), { from, text: text.trim(), at: serverTimestamp() })
  return deadline(batch.commit())
}

// "3:05 PM" today, otherwise "Nov 9, 3:05 PM".
export function messageTime(date) {
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === new Date().toDateString()) return time
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}
