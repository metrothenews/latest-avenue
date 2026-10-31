// Meta Marketing API access token: from Facebook login (connectMeta) or pasted from Graph API Explorer.
// Kept in sessionStorage (this tab) by default, or localStorage when "remember" is ticked.
// It's only ever sent to graph.facebook.com.
import { FacebookAuthProvider, linkWithPopup, reauthenticateWithPopup } from 'firebase/auth'
import { auth } from './firebase.js'
import { facebookConfigId, metaPermissions } from '../data/meta.js'

const KEY = 'meta-token'

function read(storage) {
  try {
    return storage.getItem(KEY)
  } catch {
    return null
  }
}

export const getMetaToken = () => read(sessionStorage) ?? read(localStorage)

export function setMetaToken(token, remember) {
  clearMetaToken()
  try {
    ;(remember ? localStorage : sessionStorage).setItem(KEY, token)
  } catch {
    // storage unavailable: the caller still holds the token in state
  }
}

export function clearMetaToken() {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      storage.removeItem(KEY)
    } catch {
      // ignore
    }
  }
}

// Gets a Graph API token by logging in with Facebook through Firebase, like Drive does with Google.
// The first time, the Facebook account is linked to the owner's Firebase user; after that it
// re-authenticates. Facebook's token lasts 1–2 hours; reconnecting is one click. Must be called from a click.
export async function connectMeta() {
  const provider = new FacebookAuthProvider()
  metaPermissions.forEach((p) => provider.addScope(p))
  if (facebookConfigId) provider.setCustomParameters({ config_id: facebookConfigId })
  const user = auth.currentUser
  const linked = user.providerData.some((p) => p.providerId === 'facebook.com')
  const result = linked ? await reauthenticateWithPopup(user, provider) : await linkWithPopup(user, provider)
  const token = FacebookAuthProvider.credentialFromResult(result)?.accessToken
  if (!token) throw new Error('Facebook did not return an access token.')
  setMetaToken(token, false)
  return token
}
