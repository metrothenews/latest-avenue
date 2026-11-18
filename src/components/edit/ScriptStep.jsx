import { useRef, useState } from 'react'
import { editFlow as copy } from '../../data/editFlow.js'
import { MAX_UPLOAD_BYTES, fetchDriveFolder, readScreenplay, uploadFile } from '../../lib/editProject.js'
import Button from '../ui/Button.jsx'
import { readFolder } from './FootageStep.jsx'
import { Choice, Panel, Status, ToolError, driveError, useAction, useJob } from './parts.jsx'

// Copies the footage folder again (new files only) to pick up a script added since.
function Recheck({ project, call, update, drive, onError }) {
  const [job, setJob] = useState(null)
  const [busy, setBusy] = useState(false)
  useJob(call, job, async (s) => {
    setJob(null)
    try {
      if (s.state !== 'done') throw s.error ?? { kind: 'failed', message: copy.footage.fetching }
      update({ footage: { ...project.footage, ...(await readFolder(call, s.result)) } })
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  })
  const go = async () => {
    try {
      setBusy(true)
      const token = drive.current() ?? (await drive.connect())
      const started = await call(fetchDriveFolder, { folderId: project.footage.folderId, driveToken: token })
      setJob(started.job)
    } catch (err) {
      setBusy(false)
      onError(err?.kind && err.kind !== 'auth' ? err : driveError(err))
    }
  }
  return (
    <Button variant="secondary" className="min-h-11" disabled={busy} onClick={go}>
      {busy ? copy.footage.checking : copy.script.recheck}
    </Button>
  )
}

// Sends a file from this device to the editor (in parts), then calls onSaved(saved, file).
function UploadChoice({ title, help, accept, test, call, projectId, onSaved, onError, disabled }) {
  const input = useRef(null)
  const [progress, setProgress] = useState(null)
  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (test && !test.test(file.name)) return onError({ kind: 'drive', message: copy.script.wrongType })
    if (file.size > MAX_UPLOAD_BYTES) return onError({ kind: 'drive', message: copy.script.tooLarge })
    setProgress(0)
    try {
      const saved = await call(uploadFile, projectId, file, setProgress)
      await onSaved(saved, file)
    } catch (err) {
      onError(err)
    } finally {
      setProgress(null)
    }
  }
  return (
    <>
      <Choice title={progress == null ? title : copy.script.uploading(Math.round(progress * 100))} help={help} disabled={disabled || progress != null} onClick={() => input.current?.click()} />
      <input ref={input} type="file" accept={accept} className="hidden" onChange={pick} />
    </>
  )
}

function FileChoices({ files, selected, onPick, empty }) {
  if (!files.length) return <p className="text-sm text-white/50">{empty}</p>
  return (
    <div className="space-y-2">
      {files.map((f) => <Choice key={f.path} title={f.name} selected={selected === f.path} onClick={() => onPick(f)} />)}
    </div>
  )
}

// Step 2: the script (scripted, interview) or the song and lyrics (music video).
export default function ScriptStep({ project, call, update, drive, onNext, blocked }) {
  const { kind, footage } = project
  const script = project.script
  const [choosing, setChoosing] = useState(!script)
  const { busy, error, setError, act } = useAction()
  const words = copy.script[kind] ?? copy.script.scripted
  const scripts = footage?.scripts ?? []

  const done = (s) => {
    update({ script: s, assembly: null })
    setChoosing(false)
  }
  const read = (file) =>
    act(async () => {
      const r = await call(readScreenplay, file.path)
      done({ source: 'file', path: file.path, name: file.name, scenes: r.scenes?.length ?? 0, lines: r.dialogue_lines ?? 0 })
    })
  const none = () => done({ source: 'none' })
  const uploaded = async (saved, file) => {
    const r = await call(readScreenplay, saved.relative)
    done({ source: 'upload', path: saved.relative, name: file.name, scenes: r.scenes?.length ?? 0, lines: r.dialogue_lines ?? 0 })
  }
  const upload = (title, help) => (
    <UploadChoice title={title} help={help} accept=".pdf,.fountain,.txt,application/pdf,text/plain" test={/\.(pdf|fountain|txt)$/i} call={call} projectId={project.id} onSaved={uploaded} onError={setError} />
  )
  const recheck = <Recheck project={project} call={call} update={update} drive={drive} onError={setError} />

  // Music video: the song (required) and lyrics (optional), both from the footage folder.
  if (kind === 'music') {
    const music = project.music ?? {}
    const setMusic = (m) => update({ music: { ...music, ...m }, script: { source: 'none' }, assembly: null })
    return (
      <Panel title={words.title} intro={words.intro}>
        <h2 className="text-sm font-semibold">{copy.script.song}</h2>
        <div className="mt-2 space-y-2">
          <FileChoices files={footage.audio ?? []} selected={music.song?.path} onPick={(f) => setMusic({ song: f })} empty={copy.script.noSongs} />
          <UploadChoice title={copy.script.uploadSong} help={copy.script.uploadSongHelp} accept="audio/*,.mp3,.wav,.m4a,.aif,.aiff,.flac" test={/\.(mp3|wav|m4a|aiff?|flac|aac|ogg)$/i} call={call} projectId={project.id} onSaved={(saved, file) => setMusic({ song: { name: file.name, path: saved.relative } })} onError={setError} />
        </div>
        <h2 className="mt-6 text-sm font-semibold">{copy.script.lyrics}</h2>
        <div className="mt-2 space-y-2">
          <Choice title={copy.script.noLyrics} selected={!music.lyrics} onClick={() => setMusic({ lyrics: null })} />
          <FileChoices files={scripts} selected={music.lyrics?.path} onPick={(f) => setMusic({ lyrics: f })} empty="" />
          <UploadChoice title={copy.script.uploadLyrics} accept=".pdf,.txt,.lrc,.srt,application/pdf,text/plain" test={/\.(pdf|txt|lrc|srt)$/i} call={call} projectId={project.id} onSaved={(saved, file) => setMusic({ lyrics: { name: file.name, path: saved.relative } })} onError={setError} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="min-h-11" disabled={!music.song} onClick={() => { if (!project.script) setMusic({}); onNext() }}>{copy.script.next}</Button>
          {recheck}
        </div>
        <ToolError error={error} />
      </Panel>
    )
  }

  const noneChoice = <Choice title={copy.script.none} help={copy.script.noneHelp} selected={script?.source === 'none'} onClick={none} />
  return (
    <Panel title={words.title} intro={words.intro}>
      {script && !choosing && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          {script.source !== 'none' && <p className="break-words font-semibold">{script.name}</p>}
          <div className="mt-2">
            <Status>{script.source === 'none' ? copy.script.readyNone : copy.script.ready}</Status>
            {script.source !== 'none' && <p className="mt-1 text-sm text-white/60">{copy.script.summary(script.scenes, script.lines)}</p>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="min-h-11" onClick={onNext}>{copy.script.next}</Button>
            <Button variant="secondary" className="min-h-11" onClick={() => setChoosing(true)}>{copy.script.change}</Button>
          </div>
        </div>
      )}

      {choosing && (
        <div className={`space-y-3 ${busy || blocked ? 'pointer-events-none opacity-50' : ''}`}>
          {kind === 'interview' && noneChoice}
          <h2 className="pt-1 text-sm font-semibold">{copy.script.inFolder}</h2>
          <FileChoices files={scripts} selected={script?.path} onPick={read} empty={copy.script.noneInFolder} />
          <p className="text-xs text-white/50">{copy.script.otherFolder}</p>
          <div>{recheck}</div>
          {upload(copy.script.upload, copy.script.uploadHelp)}
          {kind !== 'interview' && noneChoice}
          {busy && <Status>{copy.script.reading}</Status>}
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
