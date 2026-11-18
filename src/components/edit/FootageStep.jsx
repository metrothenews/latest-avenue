import { useState } from 'react'
import { editFlow as copy } from '../../data/editFlow.js'
import { setFootageFolder } from '../../lib/editProject.js'
import { clock } from '../../lib/editingScript.js'
import FolderPicker from '../meta/FolderPicker.jsx'
import Button from '../ui/Button.jsx'
import { Panel, Status, ToolError, driveError, useAction } from './parts.jsx'

// Step 1: connect Drive (read-only) and pick the footage folder.
export default function FootageStep({ project, call, onProject, drive, onNext, blocked }) {
  const footage = project.footage
  const [picking, setPicking] = useState(!footage || footage.state === 'failed')
  const { busy, error, setError, act } = useAction()

  const pick = (folder) =>
    act(async () => {
      onProject(await call(setFootageFolder, { folderId: folder.id, folderName: folder.name, driveToken: drive.token }))
      setPicking(false)
    })

  const onDriveError = (err) => {
    if (err?.kind === 'auth') drive.expire()
    setError(driveError(err))
  }

  return (
    <Panel title={copy.footage.title} intro={copy.footage.intro}>
      {footage && !picking && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">{copy.footage.picked}</p>
          <p className="mt-1 break-words font-semibold">{footage.folder_name}</p>
          <div className="mt-3">
            {footage.state === 'reading' && <Status>{copy.footage.reading}</Status>}
            {footage.state === 'ready' && (
              <>
                <Status>{copy.footage.ready}</Status>
                <p className="mt-1 text-sm text-white/60">{copy.footage.counts(footage.counts ?? {})}</p>
                {footage.total_s > 0 && <p className="text-sm text-white/60">{copy.footage.total(clock(footage.total_s))}</p>}
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
