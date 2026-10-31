// Meta Marketing API access token, pasted by the owner (from Graph API Explorer).
// Kept in sessionStorage (this tab) by default, or localStorage when "remember" is ticked.
// It's only ever sent to graph.facebook.com.
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
