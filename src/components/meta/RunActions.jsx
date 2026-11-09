import { useState } from 'react'
import { deleteRun, setRunArchived } from '../../lib/campaignRuns.js'

// Archive / unarchive and delete for one saved run. Neither touches anything on Meta.
// onChange(run) gets the updated run after archiving; onDeleted(id) after deleting.
export default function RunActions({ run, disabled = false, onChange, onDeleted }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function act(fn, failure) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(`${failure}: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const archive = () => act(async () => onChange(await setRunArchived(run, !run.archived)), run.archived ? "Couldn't unarchive" : "Couldn't archive")
  const remove = () => act(async () => { await deleteRun(run.id); onDeleted(run.id) }, "Couldn't delete")
  const off = disabled || busy
  const link = 'text-white/40 hover:text-white disabled:opacity-50'

  return (
    <div className="text-sm">
      {confirmDelete ? (
        <span className="text-white/60">
          Delete this saved run for good? Nothing on Meta is deleted.{' '}
          <button type="button" className="text-white underline disabled:opacity-50" onClick={remove} disabled={off}>Delete</button>{' · '}
          <button type="button" className="hover:text-white" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </span>
      ) : (
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <button type="button" className={link} onClick={archive} disabled={off}>{run.archived ? 'Unarchive' : 'Archive'}</button>
          <button type="button" className={link} onClick={() => setConfirmDelete(true)} disabled={off}>Delete</button>
        </span>
      )}
      {error && <p className="mt-1 text-red-300/90">{error}</p>}
    </div>
  )
}
