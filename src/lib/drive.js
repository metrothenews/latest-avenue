// Google Drive API v3 helpers (read-only). Docs: https://developers.google.com/drive/api/reference/rest/v3/files/list
const API = 'https://www.googleapis.com/drive/v3/files'
const FOLDER = 'application/vnd.google-apps.folder'
const FIELDS = 'nextPageToken,files(id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink,webViewLink,starred,owners(displayName,me))'

export const views = [
  { id: 'mine', label: 'My Drive' },
  { id: 'recent', label: 'Recent' },
  { id: 'starred', label: 'Starred' },
  { id: 'shared', label: 'Shared with me' },
]

// Type filter chips → Drive query clauses.
export const types = [
  { id: 'all', label: 'All' },
  { id: 'folders', label: 'Folders', q: `mimeType = '${FOLDER}'` },
  { id: 'docs', label: 'Docs', q: "mimeType = 'application/vnd.google-apps.document'" },
  { id: 'sheets', label: 'Sheets', q: "mimeType = 'application/vnd.google-apps.spreadsheet'" },
  { id: 'slides', label: 'Slides', q: "mimeType = 'application/vnd.google-apps.presentation'" },
  { id: 'pdfs', label: 'PDFs', q: "mimeType = 'application/pdf'" },
  { id: 'images', label: 'Images', q: "mimeType contains 'image/'" },
  { id: 'video', label: 'Video', q: "mimeType contains 'video/'" },
  { id: 'audio', label: 'Audio', q: "mimeType contains 'audio/'" },
]

export const sorts = [
  { id: 'modified', label: 'Last modified', orderBy: 'folder,modifiedTime desc' },
  { id: 'name', label: 'Name', orderBy: 'folder,name_natural' },
]

// Thrown for API failures; `kind` is 'auth' (token expired/revoked), 'disabled' (Drive API off) or 'other'.
export class DriveError extends Error {
  constructor(message, kind) {
    super(message)
    this.kind = kind
  }
}

const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

async function request(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.ok) return res.json()
  const body = await res.json().catch(() => ({}))
  const message = body.error?.message ?? `Drive request failed (${res.status}).`
  if (res.status === 401) throw new DriveError('Your Drive session expired.', 'auth')
  if (res.status === 403 && /has not been used|is disabled|SERVICE_DISABLED/i.test(message)) throw new DriveError(message, 'disabled')
  throw new DriveError(message, 'other')
}

// One page of files. Searching covers the whole Drive (name and contents) and is sorted by relevance,
// because Drive doesn't allow sorting full-text searches. Otherwise, My Drive lists one folder.
export function listFiles(token, { view = 'mine', folderId = 'root', search = '', type = 'all', sort = 'modified', pageToken }) {
  const text = search.trim()
  const clauses = ['trashed = false']
  if (text) clauses.push(`(name contains ${quote(text)} or fullText contains ${quote(text)})`)
  else if (view === 'mine') clauses.push(`${quote(folderId)} in parents`)
  if (view === 'starred') clauses.push('starred = true')
  if (view === 'shared') clauses.push('sharedWithMe = true')
  const typeQ = types.find((t) => t.id === type)?.q
  if (typeQ) clauses.push(typeQ)
  if (view === 'recent' && !typeQ) clauses.push(`mimeType != '${FOLDER}'`)

  const params = new URLSearchParams({ q: clauses.join(' and '), fields: FIELDS, pageSize: '100', spaces: 'drive' })
  if (!text) params.set('orderBy', view === 'recent' ? 'modifiedTime desc' : sorts.find((s) => s.id === sort).orderBy)
  if (pageToken) params.set('pageToken', pageToken)
  return request(token, `${API}?${params}`)
}

// Folder trail from My Drive down to `folderId`, e.g. [{ id: 'abc', name: 'Beats' }, ...].
export async function folderPath(token, folderId) {
  const trail = []
  let id = folderId
  while (id && id !== 'root' && trail.length < 20) {
    const f = await request(token, `${API}/${encodeURIComponent(id)}?fields=id,name,parents`)
    if (!f.parents) break // reached My Drive's root (it has no parents)
    trail.unshift({ id: f.id, name: f.name })
    id = f.parents[0]
  }
  return trail
}

export const isFolder = (file) => file.mimeType === FOLDER

// Every video directly inside a folder, sorted by name.
export async function listVideos(token, folderId) {
  const params = new URLSearchParams({
    q: `${quote(folderId)} in parents and trashed = false and mimeType contains 'video/'`,
    fields: 'nextPageToken,files(id,name,mimeType,size,md5Checksum,thumbnailLink,iconLink)',
    orderBy: 'name_natural',
    pageSize: '1000',
  })
  const files = []
  let page = {}
  do {
    if (page.nextPageToken) params.set('pageToken', page.nextPageToken)
    page = await request(token, `${API}?${params}`)
    files.push(...(page.files ?? []))
  } while (page.nextPageToken)
  return files
}

export const getFile = (token, id) => request(token, `${API}/${encodeURIComponent(id)}?fields=id,name,mimeType`)

// Downloads a file's bytes into memory.
export async function downloadFile(token, id) {
  const res = await fetch(`${API}/${encodeURIComponent(id)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) throw new DriveError('Your Drive session expired.', 'auth')
  if (!res.ok) throw new DriveError(`Couldn't download from Drive (${res.status}).`, 'other')
  return res.blob()
}

// Google's embeddable preview for a file, or null for folders.
export function previewUrl(file) {
  if (isFolder(file) || !file.webViewLink) return null
  return file.webViewLink.replace(/\/(edit|view)(\?.*)?$/, '/preview').replace(/\?usp=drivesdk$/, '')
}

// Short type name for display, e.g. "Google Doc", "PDF", "MP3".
export function typeLabel(mime) {
  const google = {
    folder: 'Folder', document: 'Google Doc', spreadsheet: 'Google Sheet', presentation: 'Google Slides',
    form: 'Google Form', drawing: 'Drawing', shortcut: 'Shortcut',
  }
  if (mime.startsWith('application/vnd.google-apps.')) return google[mime.split('.').pop()] ?? 'Google file'
  if (mime === 'application/pdf') return 'PDF'
  const common = { 'audio/mpeg': 'MP3', 'audio/mp4': 'M4A', 'audio/x-m4a': 'M4A', 'video/quicktime': 'MOV', 'image/svg+xml': 'SVG' }
  if (common[mime]) return common[mime]
  const [kind, sub] = mime.split('/')
  if (['image', 'video', 'audio'].includes(kind)) return sub.replace(/^x-/, '').split(/[.+;-]/)[0].toUpperCase()
  return 'File'
}

// 1536 -> "1.5 KB". Google-native files have no size.
export function fileSize(bytes) {
  if (bytes == null) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = Number(bytes)
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`
}

// "14:32" today, "Oct 3" this year, otherwise "Oct 3, 2024".
export function shortDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const opts = { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }) }
  return d.toLocaleDateString([], opts)
}
