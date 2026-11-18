import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth'
import { auth } from './firebase.js'

// "Save to Drive" access for exports from the /edit flow, kept apart from the read-only Drive
// access in driveAuth.js (which is unchanged). drive.file only reaches files this site creates,
// so the editor can save an export into Drive without being able to touch anything else.
// The token lasts an hour, is kept in sessionStorage (this tab only) and is only sent to Google
// and to the owner's own editor service, for the export.
export const DRIVE_EXPORT_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const KEY = 'drive-export-token'
const LIFETIME_MS = 55 * 60 * 1000

export function getDriveExportToken() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY))
    if (saved?.uid === auth?.currentUser?.uid && saved.expiresAt > Date.now()) return saved.token
  } catch {
    // storage unavailable or corrupt: treat as not connected
  }
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
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ uid: user.uid, token, expiresAt: Date.now() + LIFETIME_MS }))
  } catch {
    // storage unavailable: token still works for this page view
  }
  return token
}
