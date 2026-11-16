// The /experience story, kept in Firestore (see firestore.rules):
// - experienceDecks/{id}: a PDF to show on a monitor: { name, size, parts, createdAt }, with the
//   file as base64 text in experienceDecks/{id}/parts/{n}. The owner uploads them at
//   /admin/experience; the screen (which isn't signed in) reads one by its ID.
// - experienceStory/main: { chapters: [{ title, spot, deck }] }: the saved story. Owner only.
import { collection, deleteDoc, doc, getDoc, getDocs, getDocsFromServer, setDoc } from 'firebase/firestore'
import './firebase.js'
import { db, deadline } from './team.js'

const DECKS = 'experienceDecks'
const STORY = doc(db, 'experienceStory', 'main')
const PART_CHARS = 240000 // base64 characters per part, well inside Firestore's document limit
export const MAX_DECK_BYTES = 15 * 1024 * 1024

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1))
  reader.onerror = () => reject(new Error("Couldn't read the file."))
  reader.readAsDataURL(blob)
})

// Every uploaded PDF, newest first: [{ id, name, size, createdAt }]. Owner only.
export async function listDecks() {
  const snap = await deadline(getDocsFromServer(collection(db, DECKS)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

// Saves a PDF. onProgress(fraction) as it uploads. Returns its entry.
export async function uploadDeck(file, onProgress = () => {}) {
  if (file.size > MAX_DECK_BYTES) throw new Error('That PDF is over 15 MB.')
  const id = doc(collection(db, DECKS)).id
  const text = await toBase64(file)
  const parts = Math.max(1, Math.ceil(text.length / PART_CHARS))
  const entry = { name: file.name, size: file.size, parts, createdAt: new Date().toISOString() }
  for (let n = 0; n < parts; n += 4) {
    const batch = [n, n + 1, n + 2, n + 3].filter((i) => i < parts)
    await Promise.all(batch.map((i) => deadline(setDoc(doc(db, DECKS, id, 'parts', String(i)), { data: text.slice(i * PART_CHARS, (i + 1) * PART_CHARS) }), 120)))
    onProgress(Math.min(1, (n + batch.length) / parts))
  }
  await deadline(setDoc(doc(db, DECKS, id), entry)) // last, so a half-uploaded PDF is never listed
  return { id, ...entry }
}

export async function deleteDeck(id) {
  const parts = await deadline(getDocs(collection(db, DECKS, id, 'parts')))
  for (const part of parts.docs) await deadline(deleteDoc(part.ref)).catch(() => {})
  await deadline(deleteDoc(doc(db, DECKS, id)))
}

// A PDF's bytes, fetched once and kept while the page is open.
const fetched = new Map()
export function loadDeck(id) {
  if (!fetched.has(id)) {
    const pending = deadline(getDocs(collection(db, DECKS, id, 'parts')), 180).then(async (parts) => {
      if (parts.empty) throw new Error('That PDF is no longer here.')
      const text = parts.docs.sort((a, b) => Number(a.id) - Number(b.id)).map((d) => d.data().data ?? '').join('')
      // Through fetch, so a large file is decoded without blocking the page.
      return new Uint8Array(await (await fetch(`data:application/pdf;base64,${text}`)).arrayBuffer())
    })
    fetched.set(id, pending)
    pending.catch(() => fetched.delete(id))
  }
  // pdf.js takes over the bytes it is given, so hand out a copy each time.
  return fetched.get(id).then((bytes) => bytes.slice())
}

// The saved story's chapters ([] when none has been saved).
export async function getStory() {
  const snap = await deadline(getDoc(STORY))
  return snap.data()?.chapters ?? []
}
export const saveStory = (chapters) => deadline(setDoc(STORY, { chapters, savedAt: new Date().toISOString() }))
