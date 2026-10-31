import { useState } from 'react'
import Button from '../ui/Button.jsx'
import Notice from '../ui/Notice.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { getMe } from '../../lib/meta.js'
import { connectMeta, setMetaToken } from '../../lib/metaAuth.js'
import { metaPermissions } from '../../data/meta.js'

const POPUP_CLOSED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']
const ERRORS = {
  'auth/operation-not-allowed': 'Facebook sign-in is turned off. Enable it in Firebase → Authentication → Sign-in method.',
  'auth/credential-already-in-use': 'That Facebook account is already linked to a different user of this site.',
  'auth/account-exists-with-different-credential': 'That Facebook account’s email belongs to another sign-in. Use the token option below.',
  'auth/popup-blocked': 'Your browser blocked the Facebook popup. Allow popups for this site and try again.',
  'auth/unauthorized-domain': "This domain isn't authorized in Firebase → Authentication → Settings → Authorized domains.",
}

// Connects the Meta Marketing API: "Continue with Facebook" (token pulled automatically), or a
// pasted Graph API Explorer token as a fallback. Calls onConnect({ token, me }) once the token works.
export default function MetaConnect({ onConnect, expired }) {
  const [showPaste, setShowPaste] = useState(false)
  const [token, setToken] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function finish(value, save) {
    const me = await getMe(value)
    save()
    onConnect({ token: value, me })
  }

  async function handleFacebook() {
    setBusy(true)
    setError('')
    try {
      const value = await connectMeta()
      await finish(value, () => {})
    } catch (err) {
      if (!POPUP_CLOSED.includes(err.code)) setError(ERRORS[err.code] ?? `Couldn't connect to Facebook (${err.code ?? err.message}).`)
    } finally {
      setBusy(false)
    }
  }

  async function handlePaste(e) {
    e.preventDefault()
    const value = token.trim()
    if (!value) return setError('Paste your access token first.')
    setBusy(true)
    setError('')
    try {
      await finish(value, () => setMetaToken(value, remember))
    } catch (err) {
      setError(`Meta rejected that token: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {expired && <Notice>Your Meta connection expired. Connect again.</Notice>}
      <p className="text-sm text-white/60">
        Log in with the Facebook account that manages your ad account. Access lasts an hour or two, then you reconnect with one click.
      </p>
      <Button onClick={handleFacebook} disabled={busy}>{busy && !showPaste ? 'Waiting for Facebook…' : 'Continue with Facebook'}</Button>
      {!showPaste && <Notice>{error}</Notice>}

      <button type="button" onClick={() => { setShowPaste((s) => !s); setError('') }} className="block text-sm text-white/50 hover:text-white">
        {showPaste ? 'Hide token option' : 'Or paste an access token instead'}
      </button>

      {showPaste && (
        <form onSubmit={handlePaste} className="space-y-4 rounded-xl border border-white/10 p-4">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-white/60">
            <li>
              Open the{' '}
              <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="text-white underline">Graph API Explorer</a>{' '}
              and pick your Meta app under “Meta App”.
            </li>
            <li>Choose <b className="text-white">Get User Access Token</b> and tick: <span className="text-white/80">{metaPermissions.join(', ')}</span>.</li>
            <li>Click <b className="text-white">Generate Access Token</b> and paste it here (optionally extend it to ~60 days in the Access Token Debugger).</li>
          </ol>
          <div>
            <label htmlFor="meta-token" className="sr-only">Meta access token</label>
            <input
              id="meta-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste access token (EAA…)"
              className={fieldClass(error)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/60">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember on this browser (otherwise forgotten when the tab closes)
          </label>
          <Button type="submit" variant="secondary" disabled={busy}>{busy ? 'Checking…' : 'Connect with token'}</Button>
          <Notice>{error}</Notice>
        </form>
      )}
    </div>
  )
}
