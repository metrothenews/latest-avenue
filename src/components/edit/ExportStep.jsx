import { useState } from 'react'
import { editFlow as copy } from '../../data/editFlow.js'
import { connectDriveExport, driveFileLink, ensureExportFolder, getDriveExportToken } from '../../lib/driveExport.js'
import { EXPORT_FORMATS, exportSequence, projectDir, renderVideo, uploadToDrive } from '../../lib/editProject.js'
import Button from '../ui/Button.jsx'
import { Choice, Panel, Status, ToolError, driveError, lastLog, useAction, useJob } from './parts.jsx'

// Step 5: hand over to the sequencer (the existing live view at /edit/sequencer).
export function SequencerStep({ project, onNext }) {
  const laidOut = Boolean(project?.laidOut)
  return (
    <Panel title={copy.sequencer.title} intro={laidOut ? copy.sequencer.introLaidOut : copy.sequencer.intro}>
      <div className="flex flex-wrap gap-2">
        <Button to="/edit/sequencer" variant={laidOut ? 'secondary' : 'primary'} className="min-h-11">{copy.sequencer.open}</Button>
        {project?.assembly?.state === 'done' && <Button variant={laidOut ? 'primary' : 'secondary'} className="min-h-11" onClick={onNext}>{copy.sequencer.next}</Button>}
      </div>
    </Panel>
  )
}

const slug = (s) => (s || 'edit').replace(/[^\w -]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'edit'

// Step 6: a rendered video or a sequence for Resolve / Premiere / Final Cut, saved to Drive
// (drive.file access, asked only here).
export default function ExportStep({ project, call, update, blocked }) {
  const ex = project.export ?? { state: 'idle' }
  const [kind, setKind] = useState(ex.kind ?? 'video')
  const [token, setToken] = useState(getDriveExportToken)
  const [again, setAgain] = useState(false)
  const { busy, error, setError, act } = useAction()
  const folderName = copy.export.folderName
  const isSequence = kind !== 'video'

  const upload = useJob(call, ex.state === 'uploading' ? ex.job : null, (s) => {
    if (s.state === 'done') update({ export: { ...ex, state: 'done', fileId: s.result?.id } })
    else update({ export: { ...ex, state: 'failed', message: s.error?.kind === 'gone' ? copy.gone : (s.error?.message ?? lastLog(s)) } })
  })

  const allow = async () => {
    try {
      setToken(await connectDriveExport())
      setError(null)
    } catch (err) {
      setError(driveError(err))
    }
  }

  const go = () =>
    act(async () => {
      // The token is only good for an hour: if it ran out, ask for it again first.
      const fresh = getDriveExportToken()
      if (!fresh) {
        setToken(null)
        throw driveError({ kind: 'auth' })
      }
      setAgain(false)
      const f = EXPORT_FORMATS[kind]
      const output = `${projectDir(project)}/${slug(project.name)}-${kind}.${f.ext}`
      update({ export: { kind, state: 'making' } })
      try {
        if (kind === 'video') await call(renderVideo, output)
        else await call(exportSequence, project.assembly.output, output, f.format)
        const folderId = await ensureExportFolder(fresh, folderName).catch((err) => { throw driveError(err) })
        const started = await call(uploadToDrive, { filepath: output, folderId, driveToken: fresh })
        update({ export: { kind, state: 'uploading', job: started.job } })
      } catch (err) {
        update({ export: { kind, state: 'failed', message: err.message } })
        throw err
      }
    })

  // 'making' with nothing running means the page was closed mid-way: offer the choice again.
  const choosing = again || ex.state === 'idle' || ex.state === 'failed' || (ex.state === 'making' && !busy)
  return (
    <Panel title={copy.export.title} intro={copy.export.intro}>
      {!choosing && ex.state === 'making' && <Status>{copy.export.rendering}</Status>}
      {!choosing && ex.state === 'uploading' && (
        <div>
          <Status>{copy.export.uploading}</Status>
          {lastLog(upload.status) && <p className="mt-1 break-words text-sm text-white/50">{lastLog(upload.status)}</p>}
        </div>
      )}
      {!choosing && ex.state === 'done' && (
        <div>
          <Status>{copy.export.done}</Status>
          <div className="mt-4 flex flex-wrap gap-2">
            {ex.fileId && <Button href={driveFileLink(ex.fileId)} target="_blank" rel="noreferrer" className="min-h-11">{copy.export.openFile}</Button>}
            <Button variant="secondary" className="min-h-11" onClick={() => setAgain(true)}>{copy.export.another}</Button>
          </div>
        </div>
      )}
      {ex.state === 'failed' && !error && <ToolError error={{ kind: 'failed', message: ex.message || copy.export.failed }} onReconnect={allow} />}

      {choosing && (
        <div className="mt-2 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {copy.export.formats.map((f) => <Choice key={f.id} title={f.label} help={f.help} selected={kind === f.id} onClick={() => setKind(f.id)} />)}
          </div>
          {isSequence && <p className="text-xs text-white/50">{copy.export.sequenceNote}</p>}
          <p className="text-xs text-white/50">{copy.export.folderNote(folderName)}</p>
          {token ? (
            <Button className="min-h-11" disabled={busy || blocked || !project.assembly?.output} onClick={go}>{copy.export.start}</Button>
          ) : (
            <div>
              <Button className="min-h-11" onClick={allow}>{copy.export.connect}</Button>
              <p className="mt-2 text-xs text-white/50">{copy.export.connectHelp}</p>
            </div>
          )}
        </div>
      )}
      <ToolError error={error} onReconnect={allow} />
    </Panel>
  )
}
