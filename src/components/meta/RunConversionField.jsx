import { useState } from 'react'
import Button from '../ui/Button.jsx'
import ConversionSelect from './ConversionSelect.jsx'
import { adsetPixel } from '../../lib/meta.js'
import { saveRun } from '../../lib/campaignRuns.js'

// The conversion event every copied ad set optimizes for. Like the link, it can change until the
// run's first creative is made (the ad sets are copied after that). onSaved(run) gets the updated run.
export default function RunConversionField({ run, metaToken, onSaved, disabled = false }) {
  const [draft, setDraft] = useState(run.conversion ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const locked = run.videos.some((v) => v.creativeId)
  const id = `run-conversion-${run.id}`

  if (!run.adsets.some(adsetPixel)) return null
  if (locked) {
    return <p className="truncate text-sm text-white/50">Conversion event: <span className="text-white/70">{run.conversion?.label ?? 'same as template'}</span></p>
  }

  async function save() {
    const next = { ...run, conversion: draft }
    setSaving(true)
    setError('')
    try {
      await saveRun(next)
      onSaved(next)
    } catch (err) {
      setError(`Couldn't save the conversion event: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-white/70">Conversion event</label>
      <div className="flex gap-3">
        <ConversionSelect id={id} adsets={run.adsets} token={metaToken} accountId={run.accountId} value={draft} onChange={setDraft} disabled={disabled || saving} />
        {(draft?.key ?? '') !== (run.conversion?.key ?? '') && (
          <Button type="button" variant="secondary" onClick={save} disabled={disabled || saving} className="shrink-0">{saving ? 'Saving…' : 'Save event'}</Button>
        )}
      </div>
      {error && <p className="mt-1.5 text-sm text-red-300/90">{error}</p>}
    </div>
  )
}
