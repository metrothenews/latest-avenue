// Team assignments: ONE doc (a Google Doc, or a Word file in Drive) shown whole, with its formatting,
// on /team/assignments. The owner sets the link at /admin/team and presses Refresh to pull the
// doc's current contents; they are saved to Firestore as cleaned-up HTML for the team to read.
// Docs that the doc links to are pulled in the same way and open inside the site
// (/team/assignments/<docId>); every link is shown as a button.
// - adminSettings/assignments: { url, docId } (owner only): the doc's link.
// - portal/assignments: { title, updatedAt, version, parts, linked: [docId] }, and the HTML itself in
//   portal/assignments-<version>-<n> (split up, because a Firestore document holds at most 1 MiB).
// - portal/doc-<docId> (+ parts, same shape): each linked doc.
//   A linked Google Sheet is saved the same way, as a table (its first tab).
// - portal/file-<fileId> (+ parts, plus `rev`): a linked image, audio file, video or PDF (and Google
//   Slides, as a PDF), as a data: URL, so the team sees it on the site without Google access.
// Everything is a snapshot taken at Refresh and stays as it is until the next Refresh. Only a file
// too large to copy falls back to Google's live preview (components/team/FileViewer.jsx).
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { db, deadline } from './team.js'
import { DriveError } from './drive.js'

const SOURCE = doc(db, 'adminSettings', 'assignments')
const MAIN = 'assignments'
const linkedKey = (docId) => `doc-${docId}`
const fileKey = (fileId) => `file-${fileId}`
const metaRef = (key) => doc(db, 'portal', key)
const partRef = (key, version, n) => doc(db, 'portal', `${key}-${version}-${n}`)
const MAX_LINKED = 30 // linked docs pulled in per refresh; further ones use Google's preview instead
// Images, audio, video and PDFs up to this size are copied onto the site (as base64 it must fit in
// MAX_MEDIA_PARTS parts). Firestore isn't file storage, so this is kept modest: the free plan holds
// 1 GiB in all.
const MAX_MEDIA_BYTES = 20 * 1024 * 1024
const MAX_MEDIA_PARTS = 120
const MAX_MEDIA_TOTAL = 150 * 1024 * 1024 // newly copied per refresh
const MEDIA_TYPES = /^(image\/(png|jpeg|gif|webp)|audio\/(mpeg|mp3|mp4|x-m4a|aac|wav|x-wav|ogg)|video\/(mp4|webm|quicktime)|application\/pdf)$/
const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet'
const GOOGLE_SLIDES = 'application/vnd.google-apps.presentation'
const PART_CHARS = 240_000 // under 1 MiB even if every character takes 4 bytes
const MAX_PARTS = 40
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

const KINDS = [
  [/^application\/vnd\.google-apps\.document$|wordprocessingml/, 'Doc'],
  [/^application\/vnd\.google-apps\.spreadsheet$|spreadsheetml|^text\/csv$/, 'Sheet'],
  [/^application\/vnd\.google-apps\.presentation$|presentationml/, 'Slides'],
  [/^application\/vnd\.google-apps\.folder$/, 'Folder'],
  [/^video\//, 'Video'],
  [/^audio\//, 'Audio'],
  [/^image\//, 'Image'],
  [/^application\/pdf$/, 'PDF'],
]
const kindOf = (mimeType) => KINDS.find(([pattern]) => pattern.test(mimeType))?.[1] ?? 'File'

const toDataUrl = (blob, mimeType) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result.replace(/^data:[^;,]*/, `data:${mimeType}`))
  reader.onerror = () => reject(new Error("Couldn't read a file."))
  reader.readAsDataURL(blob)
})

const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// CSV text → an HTML table (first row as the header).
function csvToTable(csv) {
  const rows = [[]]
  let cell = ''
  let quoted = false
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { rows.at(-1).push(cell); cell = '' } else if (c === '\n' || c === '\r') {
      if (c === '\r' && csv[i + 1] === '\n') i++
      rows.at(-1).push(cell)
      cell = ''
      rows.push([])
    } else cell += c
  }
  rows.at(-1).push(cell)
  const filled = rows.filter((r) => r.some((v) => v.trim()))
  if (!filled.length) return ''
  const row = (cells, tag) => `<tr>${cells.map((v) => `<${tag}>${escapeHtml(v)}</${tag}>`).join('')}</tr>`
  return `<table><thead>${row(filled[0], 'th')}</thead><tbody>${filled.slice(1).map((r) => row(r, 'td')).join('')}</tbody></table>`
}

// A Drive file: { name, kind, rev } plus what was taken from it:
// - `html`: a Google Doc or Word file (cleaned up, see cleanHtml; a Google Doc comes from Google's
//   HTML export, a Word file is converted in the browser by mammoth), or a Google Sheet's first tab
//   as a table;
// - `media`: a data: URL for an image, audio file, video or PDF (Google Slides become a PDF) small
//   enough to copy and within `ctx.budget.bytes`; or `keep: true` when the copy already on the site
//   is still current (`ctx.known`: Map of file ID → the `rev` stored for it);
// - `tooLarge: true` for a media file over the limits.
async function fetchFile(token, fileId, ctx = { budget: { bytes: 0 }, known: new Map() }) {
  const api = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`
  const meta = await (await driveFetch(token, `${api}?fields=id,name,mimeType,size,md5Checksum,modifiedTime&supportsAllDrives=true`)).json()
  const file = { name: meta.name, kind: kindOf(meta.mimeType), mimeType: meta.mimeType, rev: meta.md5Checksum ?? meta.modifiedTime ?? '' }
  const current = Boolean(file.rev) && ctx.known.get(fileId) === file.rev
  if (meta.mimeType === GOOGLE_DOC) {
    const [html, markdown] = await Promise.all([
      driveFetch(token, `${api}/export?mimeType=text%2Fhtml`).then((r) => r.text()),
      // Only for its images: the HTML export links to images that expire, the Markdown export embeds them.
      driveFetch(token, `${api}/export?mimeType=text%2Fmarkdown`).then((r) => r.text()).catch(() => ''),
    ])
    const images = [...markdown.matchAll(/^\[[^\]]+\]:[ \t]*<?(data:image\/[^>\s]+)>?[ \t]*$/gm)].map((m) => m[1])
    file.html = cleanHtml(html, images)
  } else if (meta.mimeType === WORD_DOC) {
    const buffer = await (await driveFetch(token, `${api}?alt=media&supportsAllDrives=true`)).arrayBuffer()
    const { default: mammoth } = await import('mammoth/mammoth.browser.js')
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer }, { ignoreEmptyParagraphs: false, styleMap: ['u => u', 'strike => s'] })
    file.name = meta.name.replace(/\.docx$/i, '')
    file.html = cleanHtml(value)
  } else if (meta.mimeType === GOOGLE_SHEET) {
    file.html = csvToTable(await (await driveFetch(token, `${api}/export?mimeType=text%2Fcsv`)).text())
  } else if (meta.mimeType === GOOGLE_SLIDES) {
    if (current) file.keep = true
    else {
      const blob = await (await driveFetch(token, `${api}/export?mimeType=application%2Fpdf`)).blob()
      if (blob.size <= Math.min(MAX_MEDIA_BYTES, ctx.budget.bytes)) {
        ctx.budget.bytes -= blob.size
        file.media = await toDataUrl(blob, 'application/pdf')
      } else file.tooLarge = true
    }
  } else if (MEDIA_TYPES.test(meta.mimeType)) {
    if (Number(meta.size) > MAX_MEDIA_BYTES) file.tooLarge = true
    else if (current) file.keep = true
    else if (Number(meta.size) <= ctx.budget.bytes) {
      ctx.budget.bytes -= Number(meta.size)
      file.media = await toDataUrl(await (await driveFetch(token, `${api}?alt=media&supportsAllDrives=true`)).blob(), meta.mimeType)
    } else file.tooLarge = true
  }
  return file
}

// --- Links ---

// The Drive file a link points to (a Doc, Sheet, file or folder link), or null for any other link.
export function driveIdFromLink(href) {
  try {
    const url = new URL(href)
    if (!/^(docs|drive)\.google\.com$/.test(url.hostname)) return null
    return url.pathname.match(/\/(?:d|folders)\/([\w-]{20,})/)?.[1] ?? url.searchParams.get('id')?.match(/^[\w-]{20,}$/)?.[0] ?? null
  } catch {
    return null
  }
}

const looksLikeUrl = (text) => /^(https?:\/\/|www\.)\S+$/i.test(text.trim())

// What a link's button says when the doc just shows the bare address.
function fallbackLabel(href) {
  try {
    const url = new URL(href)
    if (url.protocol === 'mailto:') return url.pathname
    if (url.hostname === 'docs.google.com') return { document: 'Google Doc', spreadsheets: 'Google Sheet', presentation: 'Google Slides' }[url.pathname.split('/')[1]] ?? 'Google Docs'
    if (url.hostname === 'drive.google.com') return url.pathname.includes('/folders/') ? 'Drive folder' : 'Drive file'
    return url.hostname.replace(/^www\./, '')
  } catch {
    return 'Link'
  }
}

const driveIdsIn = (html) => [...new Set([...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a[href]')].map((a) => driveIdFromLink(a.getAttribute('href'))).filter(Boolean))]

// Prepares every link to be shown as a button (components/team/DocContent.jsx):
// - a bare address becomes the Drive file's name, or a short description of where it goes;
// - data-kind says what it is (Doc, Video, Audio, …; "Link" for other websites);
// - data-doc marks a doc that was pulled in (its Drive ID, or "main"), so it opens inside the site;
// - data-media marks a file (image, audio, video, PDF) that was copied onto the site (its Drive ID).
// `files`: Map of Drive file ID → { name, kind, html? } (null when Drive wouldn't show it).
// `rootId`: the assignments doc itself, which a linked doc may point back to.
function labelLinks(html, files, rootId) {
  const page = new DOMParser().parseFromString(html, 'text/html')
  for (const a of page.querySelectorAll('a')) {
    const href = a.getAttribute('href')
    if (!href) {
      a.replaceWith(...a.childNodes)
      continue
    }
    const id = driveIdFromLink(href)
    const file = id ? files.get(id) : null
    if (looksLikeUrl(a.textContent) || !a.textContent.trim()) a.textContent = file?.name ?? fallbackLabel(href)
    a.setAttribute('data-kind', file?.kind ?? (id ? (/\/document\//.test(href) ? 'Doc' : 'Drive') : href.startsWith('mailto:') ? 'Email' : 'Link'))
    // A link back to the assignments doc itself goes to the Assignments page ("main").
    if (file?.html !== undefined) a.setAttribute('data-doc', id === rootId ? 'main' : id)
    if (file?.media || file?.keep) a.setAttribute('data-media', id)
  }
  return page.body.innerHTML
}

// What's already copied onto the site: Map of file ID → the `rev` it was copied at.
async function storedRevs() {
  const ids = (await deadline(getDoc(metaRef(MAIN)))).data()?.files ?? []
  const metas = await Promise.all(ids.map((id) => deadline(getDoc(metaRef(fileKey(id))))))
  return new Map(metas.map((snap, i) => [ids[i], snap.data()?.rev]).filter(([, rev]) => rev))
}

// Reads the doc and, following its links, every page it leads to at any depth (Google Docs, Word
// files and Google Sheets, up to MAX_LINKED), plus the images, audio, video and PDFs they link to.
// Returns { name, html, linked: [{ id, name, html }], media: [{ id, name, rev, dataUrl | keep }],
// unreadable: Drive links that couldn't be read, tooLarge: media files over the size limits }.
// `onProgress(text)` reports what it's doing.
export async function fetchDocTree(token, docId, onProgress = () => {}) {
  const ctx = { budget: { bytes: MAX_MEDIA_TOTAL }, known: await storedRevs() }
  onProgress('Reading the doc…')
  const root = await fetchFile(token, docId)
  if (root.html === undefined) throw new DriveError(`That file is a ${root.mimeType}. Use a Google Doc or a Word (.docx) file.`, 'other')
  const files = new Map([[docId, root]])
  let unreadable = 0
  let docs = 1
  let queue = [docId]
  while (queue.length) {
    const next = []
    for (const id of queue) {
      const ids = driveIdsIn(files.get(id).html).filter((linkId) => !files.has(linkId))
      ids.forEach((linkId) => files.set(linkId, null)) // claimed, so two docs linking to it fetch it once
      if (ids.length) onProgress(`Reading ${ids.length} linked file${ids.length === 1 ? '' : 's'} from “${files.get(id).name}”…`)
      const fetched = await Promise.all(ids.map((linkId) => fetchFile(token, linkId, ctx).catch((err) => {
        if (err.kind === 'auth') throw err
        unreadable++
        return null
      })))
      fetched.forEach((file, i) => {
        if (file?.html !== undefined && docs > MAX_LINKED) delete file.html
        if (file?.html !== undefined) {
          docs++
          next.push(ids[i])
        }
        files.set(ids[i], file)
      })
    }
    queue = next
  }
  const linked = [...files].filter(([id, file]) => id !== docId && file?.html !== undefined)
    .map(([id, file]) => ({ id, name: file.name, html: labelLinks(file.html, files, docId) }))
  const media = [...files].filter(([, file]) => file?.media || file?.keep).map(([id, file]) => ({ id, name: file.name, rev: file.rev, ...(file.keep ? { keep: true } : { dataUrl: file.media }) }))
  const tooLarge = [...files.values()].filter((file) => file?.tooLarge).length
  return { name: root.name, html: labelLinks(root.html, files, docId), linked, media, unreadable, tooLarge }
}

// --- Cleaning the HTML ---

const KEEP = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'br', 'hr', 'a', 'img', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub'])
const DROP = new Set(['style', 'script', 'head', 'title', 'meta', 'link', 'iframe', 'object'])

// What a CSS declaration block says about text: { bold, italic, underline, strike, align }.
function readStyle(css) {
  const get = (prop) => css.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'))?.[1].trim().toLowerCase()
  const weight = get('font-weight')
  const decoration = get('text-decoration') ?? get('text-decoration-line') ?? ''
  const align = get('text-align')
  return {
    bold: weight ? weight === 'bold' || Number(weight) >= 600 : undefined,
    italic: get('font-style') ? get('font-style') === 'italic' : undefined,
    underline: decoration ? decoration.includes('underline') : undefined,
    strike: decoration ? decoration.includes('line-through') : undefined,
    align: align === 'center' || align === 'right' ? align : undefined,
  }
}

// Google wraps every link as https://www.google.com/url?q=<real link>&sa=…
function realLink(href) {
  try {
    const url = new URL(href)
    if (/(^|\.)google\.com$/.test(url.hostname) && url.pathname === '/url' && url.searchParams.get('q')) return url.searchParams.get('q')
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? href : null
  } catch {
    return null
  }
}

// Turns a doc's exported HTML into plain, safe HTML that keeps what matters for reading it:
// paragraphs and blank lines, bold / italic / underline / strikethrough, headings, lists (with
// nesting), links, tables, alignment and images. Fonts, sizes and colours are left to the site's
// own style. Google's export puts formatting in CSS classes, which are resolved here.
// `images`: data: URLs to use for the doc's images, in order (Google Docs only).
export function cleanHtml(rawHtml, images = []) {
  const source = new DOMParser().parseFromString(rawHtml, 'text/html')
  const rules = new Map()
  for (const style of source.querySelectorAll('style')) {
    for (const [, selector, css] of style.textContent.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) rules.set(selector, readStyle(css))
  }
  const styleOf = (el) => {
    const out = {}
    for (const name of el.classList) Object.entries(rules.get(name) ?? {}).forEach(([k, v]) => v !== undefined && (out[k] = v))
    Object.entries(readStyle(el.getAttribute('style') ?? '')).forEach(([k, v]) => v !== undefined && (out[k] = v))
    return out
  }

  const out = document.implementation.createHTMLDocument('')
  let imageIndex = 0

  // `inside`: 'a' or 'h' when within a link or a heading, which are underlined / bold already.
  function convert(node, parent, inside) {
    if (node.nodeType === Node.TEXT_NODE) return parent.append(out.createTextNode(node.textContent))
    if (node.nodeType !== Node.ELEMENT_NODE) return
    let tag = node.tagName.toLowerCase()
    if (DROP.has(tag)) return
    const style = styleOf(node)

    if (tag === 'img') {
      const src = images.length ? images[imageIndex++] : node.getAttribute('src')
      if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src ?? '')) return
      const img = out.createElement('img')
      img.setAttribute('src', src)
      img.setAttribute('alt', node.getAttribute('alt') ?? '')
      return parent.append(img)
    }

    let target = parent
    if (tag === 'p' && node.classList.contains('title')) tag = 'h1'
    if (KEEP.has(tag)) {
      const el = out.createElement(tag)
      if (tag === 'a') {
        const href = realLink(node.getAttribute('href') ?? '')
        if (href) el.setAttribute('href', href)
      }
      if (style.align && /^(p|h\d|td|th|li)$/.test(tag)) el.setAttribute('data-align', style.align)
      if (tag === 'ul' || tag === 'ol') {
        // Google exports a nested list as a separate list whose class ends in its depth (…-1, …-2).
        const depth = [...node.classList].map((c) => c.match(/^lst-.*-(\d)$/)?.[1]).find(Boolean)
        if (Number(depth) > 0) el.setAttribute('data-level', depth)
        if (tag === 'ol' && node.getAttribute('start')) el.setAttribute('start', node.getAttribute('start'))
      }
      if ((tag === 'td' || tag === 'th')) for (const a of ['colspan', 'rowspan']) if (node.getAttribute(a)) el.setAttribute(a, node.getAttribute(a))
      parent.append(el)
      target = el
    }
    // Formatting that arrived as CSS (Google's <span class="c3">) becomes real tags.
    const within = tag === 'a' ? `${inside}a` : /^h\d$/.test(tag) ? `${inside}h` : inside
    const linked = within.includes('a') || node.querySelector('a')
    const wraps = [style.bold && !within.includes('h') && 'strong', style.italic && 'em', style.underline && !linked && 'u', style.strike && 's']
    for (const wrap of wraps.filter(Boolean)) {
      if (!node.textContent.trim()) break
      const el = out.createElement(wrap)
      target.append(el)
      target = el
    }
    for (const child of node.childNodes) convert(child, target, within)
  }

  for (const child of source.body.childNodes) convert(child, out.body, '')
  return out.body.innerHTML.trim()
}

const withoutImages = (html) => html.replace(/<img\b[^>]*>/gi, '<em>(Image left out: the doc is too large to show with its images.)</em>')

// --- Firestore ---

export async function getSource() {
  const snap = await deadline(getDoc(SOURCE))
  return snap.exists() ? snap.data() : null
}

// Saves one doc's HTML (or a media file's data: URL) under portal/<key> (+ parts), replacing the
// version before it.
async function store(key, { title, html }, extra = {}) {
  let body = html
  let imagesRemoved = false
  const isMedia = body.startsWith('data:')
  if (body.length > PART_CHARS * MAX_PARTS && !isMedia) {
    body = withoutImages(body)
    imagesRemoved = true
  }
  if (body.length > PART_CHARS * (isMedia ? MAX_MEDIA_PARTS : MAX_PARTS)) throw new Error(`"${title}" is too ${isMedia ? 'large to copy onto the site' : 'long to show on the site, even without its images'}.`)
  const previous = (await deadline(getDoc(metaRef(key)))).data()
  const version = Date.now().toString(36)
  const parts = Math.max(1, Math.ceil(body.length / PART_CHARS))
  // Parts first, then the entry that points at them, so a reader never sees half of a new version.
  const writePart = (n) => deadline(setDoc(partRef(key, version, n), { html: body.slice(n * PART_CHARS, (n + 1) * PART_CHARS) }), 120)
  for (let n = 0; n < parts; n += 4) await Promise.all([n, n + 1, n + 2, n + 3].filter((i) => i < parts).map(writePart))
  await deadline(setDoc(metaRef(key), { title, updatedAt: new Date().toISOString(), version, parts, ...extra }))
  for (let n = 0; n < (previous?.parts ?? 0); n++) await deadline(deleteDoc(partRef(key, previous.version, n))).catch(() => {})
  return imagesRemoved
}

async function remove(key) {
  const meta = (await deadline(getDoc(metaRef(key)))).data()
  await deadline(deleteDoc(metaRef(key)))
  for (let n = 0; n < (meta?.parts ?? 0); n++) await deadline(deleteDoc(partRef(key, meta.version, n))).catch(() => {})
}

// Saves a fetchDocTree() result as what the team sees, replacing whatever was there. Files whose
// copy on the site is still current (`keep`) are left alone. Returns { imagesRemoved }.
export async function publishDoc({ url, docId, name, html, linked, media }, onProgress = () => {}) {
  const previous = (await deadline(getDoc(metaRef(MAIN)))).data()
  const before = previous?.linked ?? []
  const fresh = media.filter((m) => m.dataUrl)
  for (const [i, m] of fresh.entries()) {
    onProgress(`Copying “${m.name}” onto the site (${i + 1} of ${fresh.length})…`)
    await store(fileKey(m.id), { title: m.name, html: m.dataUrl }, { rev: m.rev })
  }
  onProgress('Saving the pages…')
  // Linked docs first, so the main doc's buttons never lead to a page that isn't there yet.
  const removed = []
  for (const l of linked) removed.push(await store(linkedKey(l.id), { title: l.name, html: l.html }))
  removed.push(await store(MAIN, { title: name, html }, { linked: linked.map((l) => l.id), files: media.map((m) => m.id) }))
  await deadline(setDoc(SOURCE, { url, docId }))
  for (const id of before.filter((old) => !linked.some((l) => l.id === old))) await remove(linkedKey(id)).catch(() => {})
  for (const id of (previous?.files ?? []).filter((old) => !media.some((m) => m.id === old))) await remove(fileKey(id)).catch(() => {})
  return { imagesRemoved: removed.some(Boolean) }
}

// When and from what the team's page was last refreshed: { title, updatedAt, linked } or null.
export async function getDocInfo() {
  const snap = await deadline(getDoc(metaRef(MAIN)))
  return snap.exists() ? snap.data() : null
}

// `onProgress(fraction)` reports how much of a large file has arrived.
async function load(key, onProgress = () => {}) {
  const snap = await deadline(getDoc(metaRef(key)))
  if (!snap.exists()) return null
  const meta = snap.data()
  const parts = []
  for (let n = 0; n < meta.parts; n += 8) {
    const batch = Array.from({ length: Math.min(8, meta.parts - n) }, (_, i) => deadline(getDoc(partRef(key, meta.version, n + i)), 60))
    parts.push(...(await Promise.all(batch)))
    onProgress(parts.length / meta.parts)
  }
  return { title: meta.title, updatedAt: meta.updatedAt, html: parts.map((p) => p.data()?.html ?? '').join('') }
}

// What the team sees: { title, updatedAt, html }, or null when no doc has been loaded yet.
export const getAssignmentsDoc = () => load(MAIN)

// A doc the assignments doc links to: { title, updatedAt, html }, or null if it wasn't pulled in.
export const getLinkedDoc = (docId) => (/^[\w-]{20,}$/.test(docId) ? load(linkedKey(docId)) : Promise.resolve(null))

// A file copied onto the site (image, audio, video or PDF): { title, dataUrl }, or null if it wasn't.
export async function getStoredFile(fileId, onProgress) {
  if (!/^[\w-]{20,}$/.test(fileId)) return null
  const file = await load(fileKey(fileId), onProgress)
  return file && /^data:(image\/|audio\/|video\/|application\/pdf)/.test(file.html) ? { title: file.title, dataUrl: file.html } : null
}

// Google's embeddable preview for a Drive link, so it can be shown inside the site, or null.
export function drivePreviewUrl(href) {
  const id = driveIdFromLink(href)
  if (!id) return null
  const path = new URL(href).pathname
  if (path.includes('/folders/')) return `https://drive.google.com/embeddedfolderview?id=${id}#list`
  const app = path.match(/^\/(document|spreadsheets|presentation)\//)?.[1]
  return app ? `https://docs.google.com/${app}/d/${id}/preview` : `https://drive.google.com/file/d/${id}/preview`
}
