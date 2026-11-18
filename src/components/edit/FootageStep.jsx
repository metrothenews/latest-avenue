import { useState } from 'react'
import { editFlow as copy } from '../../data/editFlow.js'
import { fetchDriveFolder, probeMedia } from '../../lib/editProject.js'
import { clock } from '../../lib/editingScript.js'
import FolderPicker from '../meta/FolderPicker.jsx'
import Button from '../ui/Button.jsx'
import { Panel, Status, ToolError, driveError, lastLog, useAction, useJob } from './parts.jsx'

const SCRIPT_FILE = /\.(pdf|fountain|txt)$/i

// What the next steps need to know about the copied folder.
export async function readFolder(call, fetched) {
  const probe = await call(probeMedia, fetched.folder)
  const files = probe.files ?? []
  const counts = {}
  for (const f of files) if (!f.error) counts[f.kind] = (counts[f.kind] ?? 0) + 1
  return {
    folder: fetched.folder,
    counts,
    total_s: files.reduce((t, f) => t + (f.kind === 'video' && f.duration ? f.duration : 0), 0),
    unreadable: files.filter((f) => f.error).length,
    audio: files.filter((f) => f.kind === 'audio' && !f.error).map((f) => ({ name: f.name, path: f.path })),
    scripts: (fetched.files ?? []).filter((f) => SCRIPT_FILE.test(f.name)).map((f) => ({ name: f.name, path: f.path })),
  }
}

// Step 1: connect Drive (read-only), pick the footage folder, and the editor copies it.
export default function FootageStep({ project, call, update, drive, onNext, blocked }) {
  const footage = project.footage
  const [picking, setPicking] = useState(!footage || footage.state === 'failed')
  const { busy, error, setError, act } = useAction()

  const job = useJob(call, footage?.state === 'fetching' ? footage.job : null, (s) =>
    act(async () => {
      if (s.state !== 'done') {
        update({ footage: { ...footage, state: 'failed', message: s.error?.kind === 'gone' ? copy.gone : (s.error?.message ?? lastLog(s)) } })
        return
      }
      update({ footage: { ...footage, state: 'checking' } })
      try {
        update({ footage: { ...footage, ...(await readFolder(call, s.result)), state: 'ready' } })
      } catch (err) {
        update({ footage: { ...footage, folder: s.result.folder, state: 'failed', message: err.message } })
      }
    }))

  const pick = (folder) =>
    act(async () => {
      const started = await call(fetchDriveFolder, { folderId: folder.id, driveToken: drive.token })
      update({ footage: { folderId: folder.id, folderName: folder.name, job: started.job, state: 'fetching' }, script: null, assembly: null, export: null })
      setPicking(false)
    })

  const onDriveError = (err) => {
    if (err?.kind === 'auth') drive.expire()
    setError(driveError(err))
  }

  return (
    <Panel title={copy.footage.title} intro={project.kind === 'music' ? copy.footage.introMusic : copy.footage.intro}>
      {footage && !picking && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">{copy.footage.picked}</p>
          <p className="mt-1 break-words font-semibold">{footage.folderName}</p>
          <div className="mt-3">
            {footage.state === 'fetching' && (
              <>
                <Status>{copy.footage.fetching}</Status>
                {lastLog(job.status) && <p className="mt-1 break-words text-sm text-white/50">{lastLog(job.status)}</p>}
                <p className="mt-2 text-xs text-white/50">{copy.footage.fetchingHelp}</p>
              </>
            )}
            {footage.state === 'checking' && <Status>{copy.footage.checking}</Status>}
            {footage.state === 'ready' && (
              <>
                <Status>{copy.footage.ready}</Status>
                <p className="mt-1 text-sm text-white/60">{copy.footage.counts(footage.counts ?? {})}</p>
                {footage.total_s > 0 && <p className="text-sm text-white/60">{copy.footage.total(clock(footage.total_s))}</p>}
                {footage.unreadable > 0 && <p className="text-sm text-white/50">{copy.footage.unreadable(footage.unreadable)}</p>}
              </>
            )}
            {footage.state === 'failed' && <ToolError error={{ kind: 'failed', message: footage.message }} />}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {footage.state === 'ready' && <Button className="min-h-11" onClick={onNext}>{copy.footage.next}</Button>}
            <Button variant="secondary" className="min-h-11" onClick={() => setPicking(true)}>{copy.footage.change}</Button>
          </div>
        </div>
      )}

      {picking && (
        drive.token ? (
          <div className={busy || blocked ? 'pointer-events-none opacity-50' : ''}>
            <FolderPicker token={drive.token} onPick={pick} onError={onDriveError} />
          </div>
        ) : (
          <div>
            <Button className="min-h-11" onClick={() => drive.connect().catch(onDriveError)}>{copy.footage.connect}</Button>
            <p className="mt-2 text-xs text-white/50">{copy.footage.connectHelp}</p>
          </div>
        )
      )}
      <ToolError error={error} />
    </Panel>
  )
}
