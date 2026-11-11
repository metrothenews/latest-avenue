import { useState } from 'react'
import Button from '../ui/Button.jsx'
import Notice from '../ui/Notice.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { getMe } from '../../lib/meta.js'
import { setMetaToken, startMetaLogin } from '../../lib/metaAuth.js'
import { metaPermissions } from '../../data/meta.js'

// Connects the Meta Marketing API: "Continue with Facebook" (leaves for Facebook and comes back with
// a token, see lib/metaAuth.js), or a pasted Graph API Explorer token as a fallback.
// Calls onConnect({ token, me }) once a pasted token works. loginError: why the last Facebook login failed.
// returnTo: a page to come back to after Facebook login (default: /admin/campaigns, where Facebook returns).
export default function MetaConnect({ onConnect, expired, loginError, returnTo }) {
  const [showPaste, setShowPaste] = useState(false)
  const [token, setToken] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState(loginError ?? '')
  const [busy, setBusy] = useState(false)

  async function finish(value, save) {
    const me = await getMe(value)
    save()
    onConnect({ token: value, me })
  }

  function handleFacebook() {
    setBusy(true)
    setError('')
    startMetaLogin(returnTo)
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
      <Button onClick={handleFacebook} disabled={busy}>{busy && !showPaste ? 'Going to Facebook…' : 'Continue with Facebook'}</Button>
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
