import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth'
import { auth } from './firebase.js'

// "Save to Drive" access for exports from the /edit flow, kept apart from the read-only Drive
// access in driveAuth.js (which is unchanged). drive.file only reaches files this site creates,
// so the editor can save an export into Drive without being able to touch anything else.
// The token lasts an hour and is never stored: it lives in this page's memory only, and is
// sent to Google and, with each export request, to the owner's own editor (which uses it once).
export const DRIVE_EXPORT_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const LIFETIME_MS = 55 * 60 * 1000
let held = null // { uid, token, expiresAt }

export function getDriveExportToken() {
  if (held && held.uid === auth?.currentUser?.uid && held.expiresAt > Date.now()) return held.token
  return null
}

// Opens Google's popup asking for drive.file access. Must be called from a click.
export async function connectDriveExport() {
  const user = auth.currentUser
  const provider = new GoogleAuthProvider()
  provider.addScope(DRIVE_EXPORT_SCOPE)
  provider.setCustomParameters({ login_hint: user.email })
  const result = await reauthenticateWithPopup(user, provider)
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken
  if (!token) throw new Error('Google did not return a Drive token.')
  held = { uid: user.uid, token, expiresAt: Date.now() + LIFETIME_MS }
  return token
}

const FILES = 'https://www.googleapis.com/drive/v3/files'
const FOLDER = 'application/vnd.google-apps.folder'

// The id of the exports folder in My Drive, made by this site (drive.file can only see folders
// it made), creating it the first time.
export async function ensureExportFolder(token, name) {
  const headers = { Authorization: `Bearer ${token}` }
  const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER}' and trashed = false`
  const found = await fetch(`${FILES}?${new URLSearchParams({ q, fields: 'files(id)', pageSize: '1' })}`, { headers })
  if (!found.ok) throw new Error(`Drive said no (${found.status}).`)
  const id = (await found.json()).files?.[0]?.id
  if (id) return id
  const made = await fetch(`${FILES}?fields=id`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER }),
  })
  if (!made.ok) throw new Error(`Drive said no (${made.status}).`)
  return (await made.json()).id
}

// Link to a file in Drive.
export const driveFileLink = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`
