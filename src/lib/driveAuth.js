import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth'
import { auth } from './firebase.js'

// Read-only Google Drive access for the signed-in owner.
// Google issues a 1-hour access token through the same Google sign-in Firebase uses;
// it's kept in sessionStorage (this tab only) and never sent anywhere but Google.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const KEY = 'drive-token'
const LIFETIME_MS = 55 * 60 * 1000 // a little under Google's 60 minutes

export function getDriveToken() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY))
    if (saved?.uid === auth?.currentUser?.uid && saved.expiresAt > Date.now()) return saved.token
  } catch {
    // storage unavailable or corrupt: treat as not connected
  }
  return null
}

export function clearDriveToken() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

// Opens Google's popup asking for Drive read access. Must be called from a click.
// Re-authenticates the current user, so choosing a different Google account fails.
export async function connectDrive() {
  const user = auth.currentUser
  const provider = new GoogleAuthProvider()
  provider.addScope(DRIVE_SCOPE)
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
