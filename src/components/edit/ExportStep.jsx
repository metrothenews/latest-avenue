import { useState } from 'react'
import { editFlow as copy } from '../../data/editFlow.js'
import { connectDriveExport, getDriveExportToken } from '../../lib/driveExport.js'
import { startExport } from '../../lib/editProject.js'
import Button from '../ui/Button.jsx'
import { Bar, Choice, Panel, Status, ToolError, driveError, useAction } from './parts.jsx'

// Step 5: hand over to the sequencer (the existing live view at /edit/sequencer).
export function SequencerStep() {
  return (
    <Panel title={copy.sequencer.title} intro={copy.sequencer.intro}>
      <Button to="/edit/sequencer" className="min-h-11">{copy.sequencer.open}</Button>
    </Panel>
  )
}

// Step 6: export a rendered video or a sequence to Drive (drive.file access, asked only here).
export default function ExportStep({ project, call, onProject, blocked }) {
  const ex = project.export ?? { state: 'idle' }
  const [kind, setKind] = useState('video')
  const [token, setToken] = useState(getDriveExportToken)
  const [again, setAgain] = useState(false)
  const { busy, error, setError, act } = useAction()
  const folderName = copy.export.folderName

  const allow = async () => {
    try {
      setToken(await connectDriveExport())
    } catch (err) {
      setError(driveError(err))
    }
  }
  const go = () =>
    act(async () => {
      onProject(await call(startExport, { kind, driveToken: token, folderName }))
      setAgain(false)
    })

  const choosing = ex.state === 'idle' || ex.state === 'failed' || again
  return (
    <Panel title={copy.export.title} intro={copy.export.intro}>
      {ex.state === 'running' && !again && (
        <div>
          <Status>{copy.export.running}</Status>
          <Bar value={ex.progress} />
          {ex.message && <p className="mt-2 break-words text-sm text-white/50">{ex.message}</p>}
        </div>
      )}
      {ex.state === 'done' && !again && (
        <div>
          <Status>{copy.export.done}</Status>
          <div className="mt-4 flex flex-wrap gap-2">
            {ex.drive_link && <Button href={ex.drive_link} target="_blank" rel="noreferrer" className="min-h-11">{copy.export.openFile}</Button>}
            <Button variant="secondary" className="min-h-11" onClick={() => setAgain(true)}>{copy.export.another}</Button>
          </div>
        </div>
      )}
      {ex.state === 'failed' && <ToolError error={{ kind: 'failed', message: ex.message || copy.export.failed }} />}

      {choosing && (
        <div className="mt-2 space-y-3">
          <Choice title={copy.export.video} help={copy.export.videoHelp} selected={kind === 'video'} onClick={() => setKind('video')} />
          <Choice title={copy.export.sequence} help={copy.export.sequenceHelp} selected={kind === 'sequence'} onClick={() => setKind('sequence')} />
          <p className="text-xs text-white/50">{copy.export.folderNote(folderName)}</p>
          {token ? (
            <Button className="min-h-11" disabled={busy || blocked} onClick={go}>{copy.export.start}</Button>
          ) : (
            <div>
              <Button className="min-h-11" onClick={allow}>{copy.export.connect}</Button>
              <p className="mt-2 text-xs text-white/50">{copy.export.connectHelp}</p>
            </div>
          )}
        </div>
      )}
      <ToolError error={error} />
    </Panel>
  )
}
