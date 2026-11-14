// latest avenue note: boards of cards on Firestore (see firestore.rules).
// - noteBoards/{boardId}: { title, parent (boardId | null), color, icon, iconColor, public, cardCount, createdBy, createdAt }
//   `icon` is { name, shapes: [{ tag, …attributes }] } (the drawing itself, so showing it needs no icon library).
//   "home" is the top-level board. A board inside another has a `board` card on its parent.
//   `public: true` lets anyone with the link read the board (set from Share, for a board and
//   every board inside it).
// - noteBoards/{boardId}/cards/{cardId}: { type, x, y, w, z, color, trashed, createdBy, createdAt, … }
//   type "note": html · "todo": title, items [{ id, text, done }] · "heading": text · "board": boardId
//   "column": title, collapsed (cards inside it carry `column` and `order` instead of using x, y)
//   "line": from / to { card | null, x, y }, startArrow, endArrow, dashed, weight, label, bend
//   "file": fileId, name, size, pages, thumb (a small picture of a PDF's first page)
// - noteFiles/{fileId}: { board, name, type, size, parts, createdBy, createdAt }, and the file itself as
//   base64 text in noteFiles/{fileId}/parts/{n} (a Firestore document holds at most 1 MiB). `board` is
//   the board its card is on, which decides who may read it.
// Team members read and write everything; everyone else can only read public boards.
import { collection, deleteDoc, doc, getDoc, getDocs, increment, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db, deadline } from './team.js'

export const HOME = 'home'
const BOARDS = 'noteBoards'
const boardRef = (id) => doc(db, BOARDS, id)
const cardsRef = (boardId) => collection(db, BOARDS, boardId, 'cards')
const cardRef = (boardId, id) => doc(db, BOARDS, boardId, 'cards', id)
const fileRef = (id) => doc(db, 'noteFiles', id)
const partRef = (id, n) => doc(db, 'noteFiles', id, 'parts', String(n))
const PART_CHARS = 240_000 // under 1 MiB even if every character took 4 bytes
export const MAX_FILE_BYTES = 15 * 1024 * 1024

export const newId = () => doc(collection(db, BOARDS)).id
export const isBoardId = (id) => /^[\w-]{1,40}$/.test(id ?? '')

// The home board, created the first time a team member opens it.
export async function ensureHome(email, title) {
  const snap = await deadline(getDoc(boardRef(HOME)))
  if (snap.exists()) return
  await deadline(setDoc(boardRef(HOME), { title, parent: null, color: 'default', public: false, cardCount: 0, createdBy: email, createdAt: new Date().toISOString() }))
}

// Live board document: onChange(board | null). A board the viewer may not read arrives as null.
export function watchBoard(boardId, onChange) {
  return onSnapshot(boardRef(boardId), (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null), () => onChange(null))
}

// Live cards of a board (including trashed ones): onChange([card]).
export function watchCards(boardId, onChange, onError) {
  return onSnapshot(cardsRef(boardId), (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

// Live boards directly inside `boardId`: onChange(Map of id → board). Viewers who aren't on the
// team can only ask for the public ones.
export function watchChildren(boardId, team, onChange) {
  const filters = [where('parent', '==', boardId), ...(team ? [] : [where('public', '==', true)])]
  return onSnapshot(query(collection(db, BOARDS), ...filters), (snap) => onChange(new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))), () => onChange(new Map()))
}

// The boards above this one, top first, as far up as the viewer may read: [{ id, title, color }].
export async function ancestors(board) {
  const trail = []
  let parent = board.parent
  while (parent && trail.length < 20) {
    try {
      const snap = await deadline(getDoc(boardRef(parent)))
      if (!snap.exists()) break
      trail.unshift({ id: snap.id, title: snap.data().title, color: snap.data().color })
      parent = snap.data().parent
    } catch {
      break // a private board above a shared one
    }
  }
  return trail
}

export const updateBoard = (boardId, fields) => deadline(updateDoc(boardRef(boardId), fields))

// --- Cards. Each returns once Firestore has the write (the screen updates straight away). ---

export const setCard = (boardId, card) => {
  const { id, ...data } = card
  return deadline(setDoc(cardRef(boardId, id), data))
}

export const patchCard = (boardId, id, fields) => deadline(updateDoc(cardRef(boardId, id), fields))

// Several cards at once: patches = [{ id, fields }].
export function patchCards(boardId, patches) {
  const batch = writeBatch(db)
  patches.forEach(({ id, fields }) => batch.update(cardRef(boardId, id), fields))
  return deadline(batch.commit())
}

export const removeCard = (boardId, id) => deadline(deleteDoc(cardRef(boardId, id)))

// A new board inside `parent`, plus its card on the parent. Returns the card.
export async function createBoard(parent, card, title, email) {
  const batch = writeBatch(db)
  batch.set(boardRef(card.boardId), { title, parent: parent.id, color: 'default', public: Boolean(parent.public), cardCount: 0, createdBy: email, createdAt: new Date().toISOString() })
  const { id, ...data } = card
  batch.set(cardRef(parent.id, id), data)
  await deadline(batch.commit())
  return card
}

// Moves cards into another board (dropping them on its icon). Board cards take their boards along.
export async function moveCards(fromId, to, cards) {
  const batch = writeBatch(db)
  cards.forEach((card, i) => {
    const { id, ...data } = card
    // Cards inside a column that came along keep their place in it; the rest are laid out afresh.
    batch.set(cardRef(to.id, id), data.column ? data : { ...data, column: null, x: 40 + i * 24, y: 40 + i * 24 })
    batch.delete(cardRef(fromId, id))
    if (card.type === 'board') batch.update(boardRef(card.boardId), { parent: to.id })
    if (card.type === 'file') batch.update(fileRef(card.fileId), { board: to.id })
  })
  // So the count under the board's icon is right before anyone opens it.
  batch.update(boardRef(to.id), { cardCount: increment(cards.filter((c) => !c.trashed).length) })
  await deadline(batch.commit())
  // A board moved into a shared board becomes shared too (and the other way round).
  for (const card of cards) if (card.type === 'board') await setPublic(card.boardId, Boolean(to.public))
}

// Turns the read-only link on or off for a board and every board inside it.
export async function setPublic(boardId, isPublic) {
  const queue = [boardId]
  const seen = new Set()
  while (queue.length && seen.size < 500) {
    const id = queue.shift()
    if (seen.has(id)) continue
    seen.add(id)
    await deadline(updateDoc(boardRef(id), { public: isPublic }))
    const kids = await deadline(getDocs(query(collection(db, BOARDS), where('parent', '==', id))))
    kids.forEach((d) => queue.push(d.id))
  }
}

// --- Files (PDFs). Stored as text in Firestore, so kept small: see MAX_FILE_BYTES. ---

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1))
  reader.onerror = () => reject(new Error("Couldn't read the file."))
  reader.readAsDataURL(blob)
})

// Saves a file for a card on `boardId`. onProgress(fraction) as it uploads. Returns its ID.
export async function uploadFile(boardId, file, email, onProgress = () => {}) {
  const id = newId()
  const text = await toBase64(file)
  const parts = Math.max(1, Math.ceil(text.length / PART_CHARS))
  // The entry first: the rules look it up to decide who may write and read the parts.
  await deadline(setDoc(fileRef(id), { board: boardId, name: file.name, type: file.type, size: file.size, parts, createdBy: email, createdAt: new Date().toISOString() }))
  for (let n = 0; n < parts; n += 4) {
    const batch = [n, n + 1, n + 2, n + 3].filter((i) => i < parts)
    await Promise.all(batch.map((i) => deadline(setDoc(partRef(id, i), { data: text.slice(i * PART_CHARS, (i + 1) * PART_CHARS) }), 120)))
    onProgress(Math.min(1, (n + batch.length) / parts))
  }
  return id
}

// The file as a Blob. onProgress(fraction) as it downloads.
export async function loadFile(fileId, onProgress = () => {}) {
  const meta = (await deadline(getDoc(fileRef(fileId)))).data()
  if (!meta) throw new Error('This file is no longer here.')
  const chunks = []
  for (let n = 0; n < meta.parts; n += 8) {
    const batch = Array.from({ length: Math.min(8, meta.parts - n) }, (_, i) => deadline(getDoc(partRef(fileId, n + i)), 60))
    chunks.push(...(await Promise.all(batch)).map((snap) => snap.data()?.data ?? ''))
    onProgress(chunks.length / meta.parts)
  }
  // Through fetch, so a large file is decoded without blocking the page.
  return (await fetch(`data:${meta.type || 'application/octet-stream'};base64,${chunks.join('')}`)).blob()
}

// Deletes a file for good (when its card is emptied from the trash).
export async function deleteFile(fileId) {
  const meta = (await deadline(getDoc(fileRef(fileId)))).data()
  for (let n = 0; n < (meta?.parts ?? 0); n++) await deadline(deleteDoc(partRef(fileId, n))).catch(() => {})
  await deadline(deleteDoc(fileRef(fileId)))
}
