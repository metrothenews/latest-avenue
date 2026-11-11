// Team assignments: one Google Doc (or Word file in Drive) holds a backlog of assignments, one per
// heading. The owner imports it at /admin/team; each assignment is saved as Markdown in Firestore
// and shows up in the team portal only for the people it is assigned to (see firestore.rules).
// - assignments/{key}: { title, markdown, order, assignees: [email], updatedAt }
// - adminSettings/assignments: { url, docId, level } (owner only): the source doc and heading level.
import { collection, deleteDoc, doc, getDoc, getDocsFromServer, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db, deadline } from './team.js'
import { DriveError } from './drive.js'
import { slugify } from './format.js'

const ASSIGNMENTS = 'assignments'
const SOURCE = doc(db, 'adminSettings', 'assignments')
const MAX_BYTES = 900 * 1024 // Firestore allows 1 MiB per document; keep room for the other fields
const GOOGLE_DOC = 'application/vnd.google-apps.document'
const WORD_DOC = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// "https://docs.google.com/document/d/<id>/edit…" (or a bare ID) → the file ID, or null.
export function docIdFromUrl(value) {
  const text = value.trim()
  const match = text.match(/\/d\/([\w-]{20,})/) ?? text.match(/[?&]id=([\w-]{20,})/) ?? text.match(/^([\w-]{20,})$/)
  return match ? match[1] : null
}

// --- Reading the doc from Drive (owner's read-only Drive token) ---

async function driveFetch(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.ok) return res
  const body = await res.json().catch(() => ({}))
  const message = body.error?.message ?? `Drive request failed (${res.status}).`
  if (res.status === 401) throw new DriveError('Your Drive session expired.', 'auth')
  if (res.status === 404) throw new DriveError("Drive can't find that document. Check the link, and that it's in this Google account's Drive or shared with it.", 'other')
  throw new DriveError(message, 'other')
}

// The doc as Markdown: Google's own Markdown export for a Google Doc, or a conversion in the
// browser for a Word file (Word → HTML with mammoth → Markdown with turndown).
export async function fetchDocMarkdown(token, docId) {
  const api = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}`
  const meta = await (await driveFetch(token, `${api}?fields=id,name,mimeType&supportsAllDrives=true`)).json()
  if (meta.mimeType === GOOGLE_DOC) {
    const markdown = await (await driveFetch(token, `${api}/export?mimeType=text%2Fmarkdown`)).text()
    return { name: meta.name, markdown }
  }
  if (meta.mimeType === WORD_DOC) {
    const buffer = await (await driveFetch(token, `${api}?alt=media&supportsAllDrives=true`)).arrayBuffer()
    const [{ default: mammoth }, { default: TurndownService }, { gfm }] = await Promise.all([
      import('mammoth/mammoth.browser.js'),
      import('turndown'),
      import('turndown-plugin-gfm'),
    ])
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer })
    const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
    turndown.use(gfm)
    return { name: meta.name, markdown: turndown.turndown(html) }
  }
  throw new DriveError(`That file is a ${meta.mimeType}. Use a Google Doc or a Word (.docx) file.`, 'other')
}

// --- Splitting into assignments ---

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t#]*$/
const FENCE = /^(```|~~~)/
// Google's export puts images at the end as reference definitions: [image1]: <data:image/png;base64,…>
const REF_DEF = /^\[([^\]]+)\]:[ \t]*<?(\S+?)>?[ \t]*$/

// Heading text without Markdown emphasis or escapes: "**Week 1:** Intro\_" → "Week 1: Intro_".
const plain = (text) => text.replace(/[*_]{1,3}(\S(?:.*?\S)?)[*_]{1,3}/g, '$1').replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1').trim()

// Lines of the doc, which ones are headings (outside code blocks), and its reference definitions.
function parse(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const defs = new Map()
  const body = []
  let fenced = false
  for (const line of lines) {
    if (FENCE.test(line.trim())) fenced = !fenced
    const def = !fenced && line.match(REF_DEF)
    if (def) {
      defs.set(def[1].toLowerCase(), line)
      continue
    }
    const h = !fenced && line.match(HEADING)
    body.push({ line, level: h ? h[1].length : 0, text: h ? plain(h[2]) : '' })
  }
  return { body, defs }
}

// How many headings the doc has at each level: { 1: 3, 2: 14, … }.
export function headingCounts(markdown) {
  const counts = {}
  for (const l of parse(markdown).body) if (l.level && l.text) counts[l.level] = (counts[l.level] ?? 0) + 1
  return counts
}

// The level that most likely starts each assignment: the highest level used at least twice
// (or the only one there is).
export function suggestLevel(markdown) {
  const counts = headingCounts(markdown)
  const levels = Object.keys(counts).map(Number).sort((a, b) => a - b)
  return levels.find((l) => counts[l] >= 2) ?? levels[0] ?? null
}

// Replaces embedded images with a note when an assignment is too big to save with them.
function fitSize(markdown) {
  const bytes = new TextEncoder().encode(markdown).length
  if (bytes <= MAX_BYTES) return { markdown, imagesRemoved: false }
  const note = '*(Image left out: too large to show here.)*'
  const slim = markdown
    .replace(/!\[[^\]]*\]\(\s*<?data:[^)]*\)/g, note)
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, note)
    .replace(/^\[[^\]]+\]:[ \t]*<?data:\S*$/gm, '')
  return { markdown: slim, imagesRemoved: true, tooBig: new TextEncoder().encode(slim).length > MAX_BYTES }
}

// Splits the doc at every heading of `level` (headings at that level or above end an assignment).
// Returns { intro: text before the first one, items: [{ key, title, markdown, imagesRemoved, tooBig }] }.
// `key` comes from the title, so re-importing keeps each assignment (and who it's assigned to).
export function splitAssignments(markdown, level) {
  const { body, defs } = parse(markdown)
  const items = []
  const intro = []
  let current = null
  for (const l of body) {
    if (l.level && l.level <= level && l.text) {
      if (l.level === level) {
        current = { title: l.text, lines: [] }
        items.push(current)
      } else {
        current = null // a higher heading (e.g. a section title) is not part of any assignment
      }
      continue
    }
    if (current) current.lines.push(l.line)
    else intro.push(l.line)
  }
  const used = new Map()
  return {
    intro: intro.join('\n').trim(),
    items: items.map(({ title, lines }) => {
      let text = lines.join('\n').trim()
      // Bring along the image definitions this assignment refers to.
      const refs = [...text.matchAll(/!?\[[^\]]*\]\[([^\]]+)\]/g)].map((m) => m[1].toLowerCase())
      const own = [...new Set(refs)].filter((r) => defs.has(r)).map((r) => defs.get(r))
      if (own.length) text += `\n\n${own.join('\n')}`
      const base = slugify(title).slice(0, 80) || 'assignment'
      const n = (used.get(base) ?? 0) + 1
      used.set(base, n)
      return { key: n > 1 ? `${base}-${n}` : base, title, ...fitSize(text) }
    }),
  }
}

// --- Firestore ---

export async function getSource() {
  const snap = await deadline(getDoc(SOURCE))
  return snap.exists() ? snap.data() : null
}

export const saveSource = (source) => deadline(setDoc(SOURCE, source))

const toAssignment = (d) => ({ id: d.id, ...d.data() })
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0)

// Owner: every assignment, in the doc's order.
export async function listAllAssignments() {
  const snap = await deadline(getDocsFromServer(collection(db, ASSIGNMENTS)))
  return snap.docs.map(toAssignment).sort(byOrder)
}

// A team member: the assignments given to them.
export async function listMyAssignments(email) {
  const snap = await deadline(getDocsFromServer(query(collection(db, ASSIGNMENTS), where('assignees', 'array-contains', email))))
  return snap.docs.map(toAssignment).sort(byOrder)
}

export async function getAssignment(id) {
  const snap = await deadline(getDoc(doc(db, ASSIGNMENTS, id)))
  return snap.exists() ? toAssignment(snap) : null
}

// Saves an import: adds new assignments, updates changed ones (keeping who they're assigned to)
// and deletes the ones no longer in the doc. `existing` is listAllAssignments().
export async function publishImport(items, existing) {
  const now = new Date().toISOString()
  const keys = new Set(items.map((i) => i.key))
  const writes = [
    ...items.map((item, order) => (batch) => {
      const old = existing.find((a) => a.id === item.key)
      const data = { title: item.title, markdown: item.markdown, order }
      if (!old) batch.set(doc(db, ASSIGNMENTS, item.key), { ...data, assignees: [], updatedAt: now })
      else if (old.title !== item.title || old.markdown !== item.markdown || old.order !== order) {
        batch.update(doc(db, ASSIGNMENTS, item.key), { ...data, ...(old.markdown !== item.markdown && { updatedAt: now }) })
      }
    }),
    ...existing.filter((a) => !keys.has(a.id)).map((a) => (batch) => batch.delete(doc(db, ASSIGNMENTS, a.id))),
  ]
  // A batch holds at most 500 writes.
  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db)
    writes.slice(i, i + 400).forEach((write) => write(batch))
    await deadline(batch.commit(), 60)
  }
}

export const setAssignees = (id, assignees) => deadline(updateDoc(doc(db, ASSIGNMENTS, id), { assignees }))

export const deleteAssignment = (id) => deadline(deleteDoc(doc(db, ASSIGNMENTS, id)))

// What an import would change: [{ ...item, status: 'new' | 'changed' | 'same' }] plus removed ones.
export function compareImport(items, existing) {
  const byId = new Map(existing.map((a) => [a.id, a]))
  const keys = new Set(items.map((i) => i.key))
  return {
    items: items.map((item) => {
      const old = byId.get(item.key)
      return { ...item, status: !old ? 'new' : old.markdown !== item.markdown || old.title !== item.title ? 'changed' : 'same' }
    }),
    removed: existing.filter((a) => !keys.has(a.id)),
  }
}
