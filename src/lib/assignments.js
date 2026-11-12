// Team assignments: ONE doc (a Google Doc, or a Word file in Drive) shown whole, with its formatting,
// on /team/assignments. The owner sets the link at /admin/team and presses Refresh to pull the
// doc's current contents; they are saved to Firestore as cleaned-up HTML for the team to read.
// Docs that the doc links to are pulled in the same way and open inside the site
// (/team/assignments/<docId>); every link is shown as a button.
// - adminSettings/assignments: { url, docId } (owner only): the doc's link.
// - portal/assignments: { title, updatedAt, version, parts, linked: [docId] }, and the HTML itself in
//   portal/assignments-<version>-<n> (split up, because a Firestore document holds at most 1 MiB).
// - portal/doc-<docId> (+ parts, same shape): each linked doc.
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { db, deadline } from './team.js'
import { DriveError } from './drive.js'

const SOURCE = doc(db, 'adminSettings', 'assignments')
const MAIN = 'assignments'
const linkedKey = (docId) => `doc-${docId}`
const metaRef = (key) => doc(db, 'portal', key)
const partRef = (key, version, n) => doc(db, 'portal', `${key}-${version}-${n}`)
const MAX_LINKED = 30 // linked docs pulled in per refresh; further ones open in Google instead
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

// A Drive file: { name, kind } and, for a Google Doc or a Word file, its cleaned-up `html` (see cleanHtml).
// A Google Doc comes from Google's HTML export; a Word file is converted in the browser by mammoth.
async function fetchFile(token, fileId) {
  const api = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`
  const meta = await (await driveFetch(token, `${api}?fields=id,name,mimeType&supportsAllDrives=true`)).json()
  const file = { name: meta.name, kind: kindOf(meta.mimeType), mimeType: meta.mimeType }
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
// - data-doc marks a doc that was pulled in (its Drive ID, or "main"), so it opens inside the site.
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
  }
  return page.body.innerHTML
}

// Reads the doc and, following its links, every Google Doc or Word file it leads to (up to
// MAX_LINKED). Returns { name, html, linked: [{ id, name, html }], unreadable: number of Drive links
// that couldn't be read }. Links to anything that isn't a doc keep pointing at Google.
export async function fetchDocTree(token, docId) {
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
      const fetched = await Promise.all(ids.map((linkId) => fetchFile(token, linkId).catch((err) => {
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
  return { name: root.name, html: labelLinks(root.html, files, docId), linked, unreadable }
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

// Saves one doc's HTML under portal/<key> (+ parts), replacing the version before it.
async function store(key, { title, html }, extra = {}) {
  let body = html
  let imagesRemoved = false
  if (body.length > PART_CHARS * MAX_PARTS) {
    body = withoutImages(body)
    imagesRemoved = true
  }
  if (body.length > PART_CHARS * MAX_PARTS) throw new Error(`"${title}" is too long to show on the site, even without its images.`)
  const previous = (await deadline(getDoc(metaRef(key)))).data()
  const version = Date.now().toString(36)
  const parts = Math.max(1, Math.ceil(body.length / PART_CHARS))
  // Parts first, then the entry that points at them, so a reader never sees half of a new version.
  for (let n = 0; n < parts; n++) await deadline(setDoc(partRef(key, version, n), { html: body.slice(n * PART_CHARS, (n + 1) * PART_CHARS) }), 60)
  await deadline(setDoc(metaRef(key), { title, updatedAt: new Date().toISOString(), version, parts, ...extra }))
  for (let n = 0; n < (previous?.parts ?? 0); n++) await deadline(deleteDoc(partRef(key, previous.version, n))).catch(() => {})
  return imagesRemoved
}

async function remove(key) {
  const meta = (await deadline(getDoc(metaRef(key)))).data()
  await deadline(deleteDoc(metaRef(key)))
  for (let n = 0; n < (meta?.parts ?? 0); n++) await deadline(deleteDoc(partRef(key, meta.version, n))).catch(() => {})
}

// Saves a fetchDocTree() result as what the team sees, replacing whatever was there.
// Returns { imagesRemoved }.
export async function publishDoc({ url, docId, name, html, linked }) {
  const before = (await deadline(getDoc(metaRef(MAIN)))).data()?.linked ?? []
  // Linked docs first, so the main doc's buttons never lead to a page that isn't there yet.
  const removed = []
  for (const l of linked) removed.push(await store(linkedKey(l.id), { title: l.name, html: l.html }))
  removed.push(await store(MAIN, { title: name, html }, { linked: linked.map((l) => l.id) }))
  await deadline(setDoc(SOURCE, { url, docId }))
  for (const id of before.filter((old) => !linked.some((l) => l.id === old))) await remove(linkedKey(id)).catch(() => {})
  return { imagesRemoved: removed.some(Boolean) }
}

// When and from what the team's page was last refreshed: { title, updatedAt, linked } or null.
export async function getDocInfo() {
  const snap = await deadline(getDoc(metaRef(MAIN)))
  return snap.exists() ? snap.data() : null
}

async function load(key) {
  const snap = await deadline(getDoc(metaRef(key)))
  if (!snap.exists()) return null
  const meta = snap.data()
  const parts = await Promise.all(Array.from({ length: meta.parts }, (_, n) => deadline(getDoc(partRef(key, meta.version, n)), 30)))
  return { title: meta.title, updatedAt: meta.updatedAt, html: parts.map((p) => p.data()?.html ?? '').join('') }
}

// What the team sees: { title, updatedAt, html }, or null when no doc has been loaded yet.
export const getAssignmentsDoc = () => load(MAIN)

// A doc the assignments doc links to: { title, updatedAt, html }, or null if it wasn't pulled in.
export const getLinkedDoc = (docId) => (/^[\w-]{20,}$/.test(docId) ? load(linkedKey(docId)) : Promise.resolve(null))
