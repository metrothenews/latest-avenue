import { useState } from 'react'
import Button from '../ui/Button.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { isWebUrl } from '../../lib/validation.js'
import { templateLink } from '../../lib/meta.js'
import { saveRun } from '../../lib/campaignRuns.js'

// The one link every ad of a saved run points to. It can change until the run's first creative is
// made; after that every ad must share it, so it's shown read-only. onSaved(run) gets the updated run.
export default function RunLinkField({ run, onSaved, disabled = false }) {
  const [draft, setDraft] = useState(() => run.link ?? templateLink(JSON.parse(run.templateAdJson).creative) ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const locked = run.videos.some((v) => v.creativeId)
  const ok = isWebUrl(draft)
  const id = `run-link-${run.id}`

  if (locked) {
    return <p className="truncate text-sm text-white/50">Link for every ad: <span className="text-white/70">{run.link}</span></p>
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!ok) return
    const next = { ...run, link: draft.trim() }
    setSaving(true)
    setError('')
    try {
      await saveRun(next)
      onSaved(next)
    } catch (err) {
      setError(`Couldn't save the link: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor={id} className="mb-1.5 block text-sm text-white/70">Link for every ad</label>
      <div className="flex gap-3">
        <input
          id={id}
          type="url"
          inputMode="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://…"
          autoComplete="off"
          spellCheck={false}
          className={fieldClass(draft && !ok ? 'invalid' : '')}
          disabled={disabled || saving}
        />
        {draft.trim() !== (run.link ?? '') && (
          <Button type="submit" variant="secondary" disabled={!ok || disabled || saving} className="shrink-0">{saving ? 'Saving…' : 'Save link'}</Button>
        )}
      </div>
      <p className={`mt-1.5 text-sm ${error ? 'text-red-300/90' : 'text-white/40'}`}>
        {error || (draft && !ok ? 'Enter a full address starting with https://'
          : run.link ? 'Can be changed until the first ad is made.' : 'Save a link before creating the campaign and ads.')}
      </p>
    </form>
  )
}
