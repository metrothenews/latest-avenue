import { useRef, useState } from 'react'
import Button from '../ui/Button.jsx'
import Notice from '../ui/Notice.jsx'
import RunLog from './RunLog.jsx'
import RunLinkField from './RunLinkField.jsx'
import { driveTokenMinutesLeft } from '../../lib/driveAuth.js'
import { fileSize } from '../../lib/drive.js'
import { adsManagerUrl } from '../../lib/meta.js'
import { deleteRun, saveRun } from '../../lib/campaignRuns.js'
import { finishRun, runProgress, uploadVideos } from '../../lib/campaignCopy.js'

const MIN_DRIVE_MINUTES = 20

function videoState(v, adsetCount) {
  const ads = Object.keys(v.adIds ?? {}).length
  if (!v.videoId) return v.error ? { text: 'Not uploaded', error: v.error } : { text: 'To upload' }
  if (adsetCount && ads === adsetCount) return { text: `${ads} ad${ads === 1 ? '' : 's'} created` }
  if (v.creativeId) return { text: `${ads} of ${adsetCount} ads`, error: v.error }
  return { text: v.reused ? 'Reused from Meta library' : 'Uploaded', error: v.error }
}

// One saved run of the campaign builder: stage 1 uploads the videos, stage 2 (any time later, on any
// device) waits for Meta's processing and creates the campaign and ads. See lib/campaignCopy.js.
export default function RunPanel({ run: initial, metaToken, driveToken, onConnectDrive, onChange, onDeleted, onAuthError }) {
  const [run, setRun] = useState(initial)
  const [running, setRunning] = useState('') // 'upload' | 'finish' | ''
  const [log, setLog] = useState([])
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const cancelled = useRef(false)

  const progress = runProgress(run)
  const adsetErrors = run.adsets.filter((a) => a.error && !a.newId)

  async function go(stage) {
    setError('')
    if (stage === 'upload' && driveTokenMinutesLeft() < MIN_DRIVE_MINUTES) {
      setError(`Your Drive connection expires in under ${MIN_DRIVE_MINUTES} minutes. Reconnect Drive first so the downloads don't stop halfway.`)
      return
    }
    cancelled.current = false
    setRunning(stage)
    setLog([])
    const working = JSON.parse(JSON.stringify(run))
    const save = async () => {
      setRun(JSON.parse(JSON.stringify(working)))
      onChange(working)
      await saveRun(working)
    }
    const ctx = {
      metaToken,
      driveToken,
      save,
      isCancelled: () => cancelled.current,
      log: (entry) => setLog((l) => (l.some((e) => e.id === entry.id) ? l.map((e) => (e.id === entry.id ? entry : e)) : [...l, entry])),
    }
    try {
      if (stage === 'upload') await uploadVideos(working, ctx)
      else await finishRun(working, ctx)
    } catch (err) {
      if (err.kind === 'auth') {
        setError(`${err.message} Reconnect and continue; everything so far is saved.`)
        onAuthError(err)
      } else setError(err.message)
    } finally {
      await save().catch((err) => setError(`Couldn't save progress: ${err.message}`))
      setRunning('')
    }
  }

  async function handleDelete() {
    try {
      await deleteRun(run.id)
      onDeleted(run.id)
    } catch (err) {
      setError(`Couldn't delete: ${err.message}`)
    }
  }

  const canUpload = progress.toUpload > 0
  const canFinish = progress.uploaded > 0 && !progress.complete && Boolean(run.link)

  return (
    <section className="glass mt-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{run.name}</h2>
          <p className="text-sm text-white/50">
            From “{run.campaign.name}” · 📁 {run.folder.name} · {run.adsets.length} ad set{run.adsets.length === 1 ? '' : 's'}
          </p>
        </div>
        {run.campaignId && (
          <Button variant="secondary" href={adsManagerUrl(run.accountId, run.campaignId)} target="_blank" rel="noreferrer">Review in Ads Manager</Button>
        )}
      </div>

      <div className="mt-5">
        <RunLinkField run={run} disabled={Boolean(running)} onSaved={(next) => { setRun(next); onChange(next) }} />
      </div>

      <ol className="mt-5 space-y-3 text-sm">
        <li className={progress.toUpload ? 'text-white' : 'text-white/50'}>
          <b>1. Upload</b> · {progress.uploaded} of {run.videos.length} videos on Meta
          {!progress.toUpload && ' · safe to close this page or shut down; Meta keeps processing'}
        </li>
        <li className={progress.complete ? 'text-white/50' : 'text-white'}>
          <b>2. Create campaign and ads</b> · {progress.adsMade} of {progress.adsTotal} ads created
          {progress.complete && ' · done'}
        </li>
      </ol>

      {!metaToken && <Notice>Connect Meta above to continue this run.</Notice>}
      <div className="mt-6 flex flex-wrap gap-3">
        {canUpload && (driveToken ? (
          <Button onClick={() => go('upload')} disabled={!metaToken || Boolean(running)}>
            {running === 'upload' ? 'Uploading…' : progress.uploaded ? `Upload remaining ${progress.toUpload}` : `Upload ${progress.toUpload} videos`}
          </Button>
        ) : (
          <Button onClick={onConnectDrive} disabled={Boolean(running)}>Connect Drive to upload</Button>
        ))}
        {canFinish && (
          <Button variant={canUpload ? 'secondary' : 'primary'} onClick={() => go('finish')} disabled={!metaToken || Boolean(running)}>
            {running === 'finish' ? 'Creating as videos finish processing…' : run.campaignId ? 'Continue creating ads' : 'Create campaign and ads'}
          </Button>
        )}
        {running && <Button variant="secondary" onClick={() => { cancelled.current = true }}>Stop after current step</Button>}
      </div>
      {running === 'finish' && <p className="mt-3 text-sm text-white/50">Meta can take a few minutes per video. Keep this page open, or stop and continue later.</p>}
      <Notice>{error}</Notice>
      {adsetErrors.map((a) => <Notice key={a.id}>Ad set “{a.name}” couldn't be copied: {a.error}</Notice>)}

      <ul className="mt-6 max-h-96 overflow-y-auto rounded-xl border border-white/10">
        {run.videos.map((v) => {
          const s = videoState(v, run.adsets.length)
          return (
            <li key={v.driveId} className="border-b border-white/5 px-4 py-2.5 text-sm last:border-0">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate">{v.name}</span>
                <span className="shrink-0 text-white/40">{fileSize(v.size)}</span>
                <span className="w-44 shrink-0 text-right text-white/60">{s.text}</span>
              </div>
              {s.error && <p className="mt-1 text-red-300/90">{s.error}</p>}
            </li>
          )
        })}
      </ul>

      {log.length > 0 && <div className="mt-6"><RunLog entries={log} /></div>}

      <div className="mt-6 text-sm">
        {confirmDelete ? (
          <span className="text-white/60">
            Delete this saved run? Nothing on Meta is deleted.{' '}
            <button type="button" className="text-white underline" onClick={handleDelete}>Delete</button>{' · '}
            <button type="button" className="hover:text-white" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </span>
        ) : (
          <button type="button" className="text-white/40 hover:text-white" onClick={() => setConfirmDelete(true)} disabled={Boolean(running)}>Delete saved run</button>
        )}
      </div>
    </section>
  )
}
