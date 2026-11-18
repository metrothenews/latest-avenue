import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { editFlow as copy } from '../../data/editFlow.js'
import {
  chooseTake, editEditingScript, getEditingScript, layOutEditingScript, setClipSync, setLineCut, takeThumbnails,
} from '../../lib/editProject.js'
import {
  clipName, clock, confidence, cutLength, moveLine, picture, removeLine, rows, setText, soundReport, soundStatus, toText,
} from '../../lib/editingScript.js'
import Button from '../ui/Button.jsx'
import { Panel, Status, ToolError, useAction } from './parts.jsx'
import TakeSheet from './TakeSheet.jsx'
import SyncSheet from './SyncSheet.jsx'

const HISTORY = 30
const tool = 'min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/80 hover:border-white/25 disabled:opacity-30'
const chip = 'rounded-full border px-2 py-0.5 text-[11px]'
const confidenceStyle = { strong: 'border-white/25 text-white/80', likely: 'border-white/15 text-white/60', guess: 'border-blue-300/40 text-blue-100/80', cover: 'border-white/10 text-white/50' }
const soundStyle = { synced: 'border-white/15 text-white/60', camera: 'border-white/15 text-white/50', unsynced: 'border-blue-300/40 text-blue-100/80', silent: 'border-white/10 text-white/40' }

// A textarea that grows with its text. Changes are sent when it loses focus.
function AutoText({ value, onCommit, className, label, disabled }) {
  const [draft, setDraft] = useState(value)
  const ref = useRef(null)
  useEffect(() => setDraft(value), [value])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      aria-label={label}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() && draft !== value && onCommit(draft.replace(/\s+/g, ' ').trim())}
      className={`block min-h-11 w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-1 py-2 font-mono text-[15px] leading-relaxed text-white focus:border-white/20 focus:bg-white/[0.04] focus:outline-none ${className}`}
    />
  )
}

function Line({ doc, line, first, last, busy, onOp, onOpen }) {
  const cut = line.cut
  const shown = cut ? picture(doc, line) ?? cut : null
  const takes = line.takes ?? []
  const conf = confidence(line)
  const sound = cut && doc.mode !== 'music' ? soundStatus(doc, shown.clip) : null
  const music = doc.mode === 'music'
  const text = (cls, label) => music ? <p className={`px-1 py-0.5 font-mono text-[15px] leading-relaxed ${cls}`}>{line.text}</p> : <AutoText value={line.text ?? ''} label={label} className={cls} disabled={busy} onCommit={(v) => onOp(setText, v)} />

  if (line.type === 'heading') {
    return <h3 className="border-b border-white/5 px-1 pb-2 pt-6 font-mono text-[15px] font-bold uppercase first:pt-2">{line.text}</h3>
  }
  return (
    <article className="border-b border-white/5 py-3 last:border-0">
      {line.type === 'action' && text('', copy.editing.editText)}
      {line.type === 'transition' && text('text-right uppercase', copy.editing.editText)}
      {line.type === 'dialogue' && (
        <div className="px-[6%] sm:px-[18%]">
          <p className="text-center font-mono text-[15px] uppercase text-white/90">{line.character}{(line.extensions ?? []).map((e) => ` (${e})`).join('')}</p>
          {(line.parentheticals ?? []).map((p, i) => <p key={i} className="text-center font-mono text-sm text-white/60">{p.text}</p>)}
          {text('', `${copy.editing.editText}: ${line.character ?? ''}`)}
        </div>
      )}

      {line.type !== 'transition' && (
        cut ? (
          <button type="button" disabled={busy} onClick={() => onOpen(line.id)} className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs hover:border-white/25 disabled:opacity-60">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                {conf && <span className={`${chip} ${confidenceStyle[conf]}`}>{copy.editing.confidence[conf]}</span>}
                {sound && <span className={`${chip} ${soundStyle[sound.status]}`}>{sound.status === 'synced' ? copy.editing.sound.synced(sound.method) : copy.editing.sound[sound.status]}</span>}
              </span>
              <span className="mt-1 block">
                {takes.length > 0 && line.take != null && <span className="font-semibold text-white/80">{copy.editing.takeOf(line.take + 1, takes.length)} · </span>}
                <span className="break-all text-white/50">{clipName(doc, shown.clip)}</span>
              </span>
              <span className="block text-white/50">{clock(shown.in)} → {clock(shown.in + (cut.out - cut.in))} ({clock(cut.out - cut.in)})</span>
            </span>
            {takes.length > 0 && <span className="shrink-0 text-blue-100/70">{music ? copy.editing.changePicture : copy.editing.changeTake}</span>}
          </button>
        ) : (
          line.type === 'dialogue' && <p className="mt-2 px-1 text-xs text-white/50">{copy.editing.noFootage}</p>
        )
      )}

      {!music && <div className="mt-2 flex flex-wrap gap-2 px-1">
        <button type="button" className={tool} disabled={busy || first} onClick={() => onOp(moveLine, -1)} aria-label={`${copy.editing.up}: ${line.id}`}>↑ {copy.editing.up}</button>
        <button type="button" className={tool} disabled={busy || last} onClick={() => onOp(moveLine, 1)} aria-label={`${copy.editing.down}: ${line.id}`}>↓ {copy.editing.down}</button>
        <button type="button" className={tool} disabled={busy} onClick={() => onOp(removeLine)}>{copy.editing.remove}</button>
      </div>}
    </article>
  )
}

function SoundPanel({ doc, onFix }) {
  const [all, setAll] = useState(false)
  if (doc.mode === 'music') return null
  const report = soundReport(doc)
  if (!report.length) return null
  const problems = report.filter((c) => c.status !== 'synced')
  const shown = all ? report : problems
  return (
    <Panel title={copy.editing.soundTitle} intro={copy.editing.soundIntro}>
      {!problems.length && !all && <p className="text-sm text-white/60">{copy.editing.soundAll(report.length)}</p>}
      <ul className="space-y-2">
        {shown.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <span className="min-w-0 flex-1 break-all">{c.name}</span>
            <span className={`${chip} ${soundStyle[c.status]}`}>{c.status === 'synced' ? copy.editing.sound.synced(c.method) : copy.editing.sound[c.status]}</span>
            <button type="button" className={tool} onClick={() => onFix(c.id)}>{copy.editing.soundFix}</button>
          </li>
        ))}
      </ul>
      <button type="button" className={`${tool} mt-3`} onClick={() => setAll((v) => !v)}>{all ? copy.editing.soundShowProblems : copy.editing.soundShowAll}</button>
    </Panel>
  )
}

// Step 4: the editing script, edited like a screenplay. Each change is saved in the editor
// straight away, and the page shows the editor's result.
export default function EditingStep({ project, call, blocked, onBack }) {
  const navigate = useNavigate()
  const path = project.assembly.output
  const [doc, setDoc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [sheet, setSheet] = useState(null) // line id
  const [thumbs, setThumbs] = useState({})  // line id -> { take index: data URL }
  const [syncClip, setSyncClip] = useState(null)
  const [syncNote, setSyncNote] = useState('')
  const history = useRef([])
  const load = useAction()
  const submit = useAction()

  const fetchDoc = () => load.act(async () => setDoc(await call(getEditingScript, path)))
  useEffect(() => { fetchDoc() }, [path]) // eslint-disable-line react-hooks/exhaustive-deps

  // Runs one change in the editor, then reloads the document from it.
  const change = async (fn, optimistic) => {
    if (optimistic) setDoc(optimistic)
    setSaving(true)
    setSaveError(null)
    try {
      await fn()
      setDoc(await call(getEditingScript, path))
      setThumbs({})
    } catch (err) {
      setSaveError(err)
      setDoc(await call(getEditingScript, path).catch(() => doc))
    } finally {
      setSaving(false)
    }
  }
  const textChange = (next) => {
    history.current = [...history.current, toText(doc)].slice(-HISTORY)
    change(() => call(editEditingScript, path, toText(next)), next)
  }
  const undo = () => {
    const prev = history.current.pop()
    if (prev) change(() => call(editEditingScript, path, prev))
  }

  // The takes' pictures, fetched when a line's takes are opened (once per line and version).
  const openSheet = async (id) => {
    setSheet(id)
    if (thumbs[id]) return
    try {
      const r = await call(takeThumbnails, path, id)
      setThumbs((t) => ({ ...t, [id]: Object.fromEntries((r.takes ?? []).filter((x) => x.data_url).map((x) => [x.take, x.data_url])) }))
    } catch {
      // thumbnails are a nicety: the list works without them
    }
  }
  const fixSync = (fn) => change(async () => { await fn(); setSyncNote(copy.editing.sync.saved) })

  const onSubmit = () =>
    submit.act(async () => {
      await call(layOutEditingScript, path)
      navigate('/edit/sequencer')
    })

  if (!doc) {
    return (
      <Panel title={copy.editing.title}>
        {load.busy && <Status>{copy.loading}</Status>}
        <ToolError error={load.error} onRetry={fetchDoc} />
      </Panel>
    )
  }

  const list = rows(doc)
  const lines = list.filter((l) => l.type !== 'heading')
  const sheetLine = sheet && lines.find((l) => l.id === sheet)
  const busy = saving || blocked

  return (
    <div className="space-y-4">
      <Panel title={doc.title || copy.editing.title} intro={doc.mode === 'music' ? copy.editing.introMusic : copy.editing.intro}>
        <p className="text-sm text-white/60">{copy.editing.length(clock(cutLength(doc)))}</p>
        {!lines.length && (
          <div className="mt-4">
            <p className="font-semibold">{copy.editing.empty}</p>
            <p className="mt-1 text-sm text-white/60">{copy.editing.emptyHelp}</p>
            <div className="mt-3"><Button variant="secondary" className="min-h-11" onClick={onBack}>{copy.script.change}</Button></div>
          </div>
        )}
        <div className="mt-2">
          {list.map((l) => (
            <Line
              key={l.id}
              doc={doc}
              line={l}
              first={l.id === lines[0]?.id}
              last={l.id === lines.at(-1)?.id}
              busy={busy}
              onOp={(fn, arg) => textChange(fn(doc, l.id, arg))}
              onOpen={openSheet}
            />
          ))}
        </div>
      </Panel>

      <SoundPanel doc={doc} onFix={(clip) => { setSyncNote(''); setSyncClip(clip) }} />
      {syncNote && <p role="status" className="px-1 text-sm text-white/60">{syncNote}</p>}

      <Panel title={copy.editing.unusedTitle} intro={copy.editing.unusedIntro}>
        {!doc.unplaced?.length && <p className="text-sm text-white/50">{copy.editing.unusedNone}</p>}
        <ul className="space-y-1">
          {(doc.unplaced ?? []).map((id) => <li key={id} className="break-all text-sm text-white/70">{clipName(doc, id)}</li>)}
        </ul>
      </Panel>

      <div className="glass-bar sticky bottom-0 z-10 -mx-4 border-t px-4 py-3 sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" className="text-xs text-white/60">{saving ? copy.editing.saving : saveError ? copy.editing.saveFailed : copy.editing.saved}</span>
          {doc.mode !== 'music' && <button type="button" className={tool} disabled={busy || !history.current.length} onClick={undo}>{copy.editing.undo}</button>}
          <Button className="ml-auto min-h-11" disabled={busy || submit.busy || !lines.length} onClick={onSubmit}>
            {submit.busy ? copy.editing.submitting : copy.editing.submit}
          </Button>
        </div>
        <ToolError error={saveError ?? submit.error} />
      </div>

      <SyncSheet
        doc={doc}
        clip={syncClip}
        busy={saving}
        onClose={() => setSyncClip(null)}
        onSave={(audioClip, offset) => { fixSync(() => call(setClipSync, path, syncClip, { audioClip, offset })); setSyncClip(null) }}
        onCamera={() => { fixSync(() => call(setClipSync, path, syncClip, { clear: true })); setSyncClip(null) }}
      />

      <TakeSheet
        doc={doc}
        line={sheetLine}
        thumbs={sheet ? thumbs[sheet] : null}
        busy={saving}
        onClose={() => setSheet(null)}
        onChoose={(i) => change(() => call(chooseTake, path, sheet, i))}
        onTrim={(a, b) => change(() => call(setLineCut, path, sheet, a, b))}
      />
    </div>
  )
}
