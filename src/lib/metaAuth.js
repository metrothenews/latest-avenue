// Meta Marketing API access token: from Facebook login (startMetaLogin) or pasted from Graph API Explorer.
// Kept in sessionStorage (this tab) by default, or localStorage when "remember" is ticked.
// It's only ever sent to graph.facebook.com.
import { GRAPH_VERSION } from './meta.js'
import { facebookAppId, facebookConfigId, metaPermissions } from '../data/meta.js'

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

// Facebook login, done directly rather than through Firebase: Firebase always adds the `email`
// permission, which Business-type Meta apps reject. The whole page goes to Facebook and comes back
// to /admin/campaigns with the token in the URL; readMetaLoginRedirect() picks it up from there.
// Facebook's token lasts 1–2 hours; reconnecting is one click.
const DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`
const STATE_KEY = 'meta-login-state'

// Must be listed under Valid OAuth Redirect URIs in the Meta app, for every domain the site runs on.
export const metaRedirectUri = () => `${window.location.origin}/admin/campaigns`

export function startMetaLogin() {
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)
  const params = new URLSearchParams({ client_id: facebookAppId, redirect_uri: metaRedirectUri(), response_type: 'token', state })
  if (facebookConfigId) params.set('config_id', facebookConfigId)
  else params.set('scope', metaPermissions.join(','))
  window.location.assign(`${DIALOG}?${params}`)
}

// The result of coming back from Facebook: { token }, { error }, or null if this page load wasn't one.
// Read once per page load (the URL is cleaned straight away), so repeat calls get the same answer.
let redirectResult
export function readMetaLoginRedirect() {
  if (redirectResult !== undefined) return redirectResult
  redirectResult = null
  // Facebook puts the token in the #fragment, but a cancelled login comes back as ?error=… instead.
  const params = new URLSearchParams(window.location.search)
  new URLSearchParams(window.location.hash.slice(1)).forEach((v, k) => params.set(k, v))
  if (!params.has('access_token') && !params.has('error')) return redirectResult
  let expected = null
  try {
    expected = sessionStorage.getItem(STATE_KEY)
    sessionStorage.removeItem(STATE_KEY)
  } catch {
    // storage unavailable: the state check below fails safely
  }
  window.history.replaceState(null, '', window.location.pathname)
  if (!expected || params.get('state') !== expected) {
    redirectResult = { error: "That Facebook login didn't start from this tab, so it was ignored. Try again." }
  } else if (params.has('error')) {
    redirectResult = { error: params.get('error_reason') === 'user_denied' ? 'Facebook login was cancelled.' : `Facebook login failed: ${params.get('error_description') ?? params.get('error')}` }
  } else {
    setMetaToken(params.get('access_token'), false)
    redirectResult = { token: params.get('access_token') }
  }
  return redirectResult
}
