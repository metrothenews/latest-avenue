import { useState } from 'react'
import Button from '../ui/Button.jsx'
import Notice from '../ui/Notice.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { getMe } from '../../lib/meta.js'
import { setMetaToken } from '../../lib/metaAuth.js'

const PERMISSIONS = 'ads_management, ads_read, business_management, pages_show_list, pages_read_engagement, pages_manage_ads'

// Paste-a-token form for the Meta Marketing API. Calls onConnect({ token, me }) once the token works.
export default function MetaConnect({ onConnect, expired }) {
  const [token, setToken] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const value = token.trim()
    if (!value) return setError('Paste your access token first.')
    setChecking(true)
    setError('')
    try {
      const me = await getMe(value)
      setMetaToken(value, remember)
      onConnect({ token: value, me })
    } catch (err) {
      setError(`Meta rejected that token: ${err.message}`)
    } finally {
      setChecking(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {expired && <Notice>Your Meta token expired. Paste a new one.</Notice>}
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-white/60">
        <li>
          Open the{' '}
          <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="text-white underline">Graph API Explorer</a>{' '}
          and pick your Meta app under “Meta App”.
        </li>
        <li>Under “User or Page”, choose <b className="text-white">Get User Access Token</b> and tick: <span className="text-white/80">{PERMISSIONS}</span>.</li>
        <li>Click <b className="text-white">Generate Access Token</b>, approve, then copy the token here. It lasts about an hour.</li>
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
      <Button type="submit" disabled={checking}>{checking ? 'Checking…' : 'Connect Meta'}</Button>
      <Notice>{error}</Notice>
    </form>
  )
}
