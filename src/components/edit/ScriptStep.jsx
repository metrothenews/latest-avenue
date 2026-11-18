import { useEffect, useRef, useState } from 'react'
import { editFlow as copy } from '../../data/editFlow.js'
import { listFiles } from '../../lib/drive.js'
import { MAX_UPLOAD_BYTES, setScriptFromDrive, skipScript, uploadScript } from '../../lib/editProject.js'
import FileIcon from '../drive/FileIcon.jsx'
import Button from '../ui/Button.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { Choice, Panel, Status, ToolError, driveError, useAction } from './parts.jsx'

// Search box over the PDFs in Drive. Calls onPick(file).
function PdfPicker({ token, onPick, onError }) {
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      setLoading(true)
      listFiles(token, query.trim() ? { search: query, type: 'pdfs' } : { view: 'recent', type: 'pdfs' })
        .then((r) => !cancelled && setFiles(r.files ?? []))
        .catch((err) => !cancelled && onError(err))
        .finally(() => !cancelled && setLoading(false))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [token, query]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <label htmlFor="pdf-search" className="sr-only">{copy.script.search}</label>
      <input id="pdf-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.script.search} autoComplete="off" className={fieldClass()} />
      <ul className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-white/10">
        {files.map((f) => (
          <li key={f.id} className="border-b border-white/5 last:border-0">
            <button type="button" onClick={() => onPick(f)} className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-white/[0.05]">
              <FileIcon file={f} className="h-7 w-7 shrink-0" />
              <span className="min-w-0 truncate">{f.name}</span>
            </button>
          </li>
        ))}
        {!loading && !files.length && <li className="px-3 py-6 text-center text-sm text-white/40">{copy.script.noPdfs}</li>}
        {loading && <li className="px-3 py-6 text-center text-sm text-white/40">{copy.loading}</li>}
      </ul>
    </div>
  )
}

// Step 2: the script PDF, from Drive or the device, or none.
export default function ScriptStep({ project, call, onProject, drive, onNext, blocked }) {
  const script = project.script
  const [choosing, setChoosing] = useState(!script || script.state === 'failed')
  const [mode, setMode] = useState(null) // 'drive' while the Drive picker is open
  const { busy, error, setError, act } = useAction()
  const fileInput = useRef(null)

  const done = (p) => {
    onProject(p)
    setChoosing(false)
    setMode(null)
  }
  const fromDrive = (f) => act(async () => done(await call(setScriptFromDrive, { fileId: f.id, name: f.name, driveToken: drive.token })))
  const none = () => act(async () => done(await call(skipScript)))
  const upload = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type && file.type !== 'application/pdf') return setError({ kind: 'drive', message: copy.script.notPdf })
    if (file.size > MAX_UPLOAD_BYTES) return setError({ kind: 'drive', message: copy.script.tooLarge })
    act(async () => done(await call(uploadScript, file)))
  }
  const onDriveError = (err) => {
    if (err?.kind === 'auth') drive.expire()
    setError(driveError(err))
  }

  return (
    <Panel title={copy.script.title} intro={copy.script.intro}>
      {script && !choosing && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          {script.source !== 'none' && <p className="break-words font-semibold">{script.name}</p>}
          <div className="mt-2">
            {script.state === 'reading' && <Status>{copy.script.reading}</Status>}
            {script.state === 'ready' && (
              <>
                <Status>{script.source === 'none' ? copy.script.readyNone : copy.script.ready}</Status>
                {script.source !== 'none' && script.lines != null && <p className="mt-1 text-sm text-white/60">{copy.script.summary(script.scenes ?? 0, script.lines)}</p>}
              </>
            )}
            {script.state === 'failed' && <ToolError error={{ kind: 'failed', message: script.message }} />}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {script.state === 'ready' && <Button className="min-h-11" onClick={onNext}>{copy.script.next}</Button>}
            <Button variant="secondary" className="min-h-11" onClick={() => setChoosing(true)}>{copy.script.change}</Button>
          </div>
        </div>
      )}

      {choosing && (
        <div className={`space-y-3 ${busy || blocked ? 'pointer-events-none opacity-50' : ''}`}>
          <Choice title={copy.script.fromDrive} selected={mode === 'drive'} onClick={() => setMode(mode === 'drive' ? null : 'drive')} />
          {mode === 'drive' && (
            drive.token
              ? <PdfPicker token={drive.token} onPick={fromDrive} onError={onDriveError} />
              : (
                <div className="pl-1">
                  <Button className="min-h-11" onClick={() => drive.connect().catch(onDriveError)}>{copy.footage.connect}</Button>
                  <p className="mt-2 text-xs text-white/50">{copy.footage.connectHelp}</p>
                </div>
              )
          )}
          <Choice title={copy.script.upload} help={copy.script.uploadHelp} onClick={() => fileInput.current?.click()} />
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={upload} />
          <Choice title={copy.script.none} help={copy.script.noneHelp} onClick={none} />
        </div>
      )}
      <ToolError error={error} />

      {/* Step 3 of Sam's plan (script supervisor notes) holds its place here until it is built. */}
      <div className="mt-6 flex items-start gap-3 border-t border-white/10 pt-4 text-sm text-white/40">
        <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-xs">{copy.script.laterTag}</span>
        <p><span className="text-white/60">{copy.script.later}.</span> {copy.script.laterHelp}</p>
      </div>
    </Panel>
  )
}
