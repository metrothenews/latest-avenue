import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { editFlow as copy } from '../../data/editFlow.js'
import { getEditingScript, saveEditingScript, submitEditingScript } from '../../lib/editProject.js'
import {
  appendUnmatched, chooseTake, chosenTake, clock, cutLength, giveClip, moveLine, setOmitted, setText, trimTake,
} from '../../lib/editingScript.js'
import Button from '../ui/Button.jsx'
import { Panel, Status, ToolError, useAction } from './parts.jsx'
import TakeSheet from './TakeSheet.jsx'

const SAVE_DELAY_MS = 1500
const HISTORY = 50
const tool = 'min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/80 hover:border-white/25 disabled:opacity-30'

// A textarea that grows with its text, so the script reads as one document.
function AutoText({ value, onChange, onFocus, className, label }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label={label}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      className={`block w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-1 py-0.5 font-mono text-[15px] leading-relaxed text-white focus:border-white/20 focus:bg-white/[0.04] focus:outline-none ${className}`}
    />
  )
}

function Line({ line, index, count, onChange, onFocusText, onOpen }) {
  const take = chosenTake(line)
  const takes = line.takes ?? []
  const n = takes.findIndex((t) => t.id === line.chosen) + 1
  const text = (cls, label) => <AutoText value={line.text ?? ''} label={label} className={cls} onFocus={onFocusText} onChange={(v) => onChange(setText, v)} />
  return (
    <article className={`border-b border-white/5 py-3 last:border-0 ${line.omitted ? 'opacity-50' : ''}`}>
      {line.type === 'heading' && text('font-bold uppercase', 'Scene heading')}
      {line.type === 'action' && text('', 'Action')}
      {line.type === 'transition' && text('text-right uppercase', 'Transition')}
      {line.type === 'dialogue' && (
        <div className="px-[6%] sm:px-[18%]">
          <p className="text-center font-mono text-[15px] uppercase text-white/90">{line.character}</p>
          {line.parenthetical && <p className="text-center font-mono text-sm text-white/60">({line.parenthetical.replace(/^\(|\)$/g, '')})</p>}
          {text('', `${copy.editing.speaker}: ${line.character ?? ''}`)}
        </div>
      )}
      {line.omitted && <p className="mt-1 px-1 text-xs uppercase tracking-wide text-white/50">{copy.editing.cutNote}</p>}

      {line.type !== 'heading' && (
        take ? (
          <button type="button" onClick={() => onOpen(line, false)} className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs hover:border-white/25">
            {take.thumb && <img src={take.thumb} alt="" className="h-9 w-14 shrink-0 rounded object-cover" />}
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-white/80">{copy.editing.takeOf(n, takes.length)}</span>
              <span className="text-white/50"> · {take.name}</span>
              <span className="block text-white/50">{clock(take.in_s)} → {clock(take.out_s)} ({clock(take.out_s - take.in_s)})</span>
            </span>
            <span className="shrink-0 text-blue-100/70">{copy.editing.changeTake}</span>
          </button>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-xs text-white/50">
            <span>{copy.editing.noFootage}</span>
            <button type="button" className={tool} onClick={() => onOpen(line, true)}>{copy.editing.giveClip}</button>
          </div>
        )
      )}

      <div className="mt-2 flex flex-wrap gap-2 px-1">
        <button type="button" className={tool} disabled={index === 0} onClick={() => onChange(moveLine, -1)} aria-label={`${copy.editing.up}: line ${index + 1}`}>↑ {copy.editing.up}</button>
        <button type="button" className={tool} disabled={index === count - 1} onClick={() => onChange(moveLine, 1)} aria-label={`${copy.editing.down}: line ${index + 1}`}>↓ {copy.editing.down}</button>
        <button type="button" className={tool} onClick={() => onChange(setOmitted, !line.omitted)}>{line.omitted ? copy.editing.restore : copy.editing.cut}</button>
      </div>
    </article>
  )
}

// Step 4: the editing script, edited like a screenplay. Saves by itself after each change.
export default function EditingStep({ call, onBack, blocked }) {
  const navigate = useNavigate()
  const [script, setScript] = useState(null)
  const [save, setSave] = useState('saved') // saved | dirty | saving | failed
  const [sheet, setSheet] = useState(null)  // { id, clips }
  const history = useRef([])
  const latest = useRef(null)
  const timer = useRef(null)
  const load = useAction()
  const submit = useAction()

  const fetchScript = () =>
    load.act(async () => {
      const s = await call(getEditingScript)
      latest.current = s
      setScript(s)
    })
  useEffect(() => { fetchScript() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    if (!latest.current) return
    setSave('saving')
    try {
      await call(saveEditingScript, latest.current)
      setSave((v) => (v === 'saving' ? 'saved' : v))
    } catch (err) {
      setSave('failed')
      throw err
    }
  }, [call])

  const update = (next, remember = true) => {
    if (next === latest.current) return
    if (remember) history.current = [...history.current, latest.current].slice(-HISTORY)
    latest.current = next
    setScript(next)
    setSave('dirty')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => flush().catch(() => {}), SAVE_DELAY_MS)
  }
  useEffect(() => () => {
    // Leaving the step: save what's pending.
    if (timer.current) {
      clearTimeout(timer.current)
      if (latest.current) call(saveEditingScript, latest.current).catch(() => {})
    }
  }, [call])

  const undo = () => {
    const prev = history.current.pop()
    if (prev) update(prev, false)
  }

  const onSubmit = () =>
    submit.act(async () => {
      await flush()
      await call(submitEditingScript)
      navigate('/edit/sequencer')
    })

  if (!script) {
    return (
      <Panel title={copy.editing.title}>
        {load.busy && <Status>{copy.loading}</Status>}
        <ToolError error={load.error} onRetry={fetchScript} />
      </Panel>
    )
  }

  const lines = script.lines ?? []
  const sheetLine = sheet && lines.find((l) => l.id === sheet.id)
  const saveLabel = { saved: copy.editing.saved, dirty: copy.editing.unsaved, saving: copy.editing.saving, failed: copy.editing.saveFailed }[save]

  return (
    <div className="space-y-4">
      <Panel title={script.title || copy.editing.title} intro={copy.editing.intro}>
        <p className="text-sm text-white/60">{copy.editing.length(clock(cutLength(script)))}</p>
        {!lines.length && (
          <div className="mt-4">
            <p className="font-semibold">{copy.editing.empty}</p>
            <p className="mt-1 text-sm text-white/60">{copy.editing.emptyHelp}</p>
            <div className="mt-3"><Button variant="secondary" className="min-h-11" onClick={onBack}>{copy.script.change}</Button></div>
          </div>
        )}
        <div className="mt-4">
          {lines.map((l, i) => (
            <Line
              key={l.id}
              line={l}
              index={i}
              count={lines.length}
              onFocusText={() => { history.current = [...history.current, latest.current].slice(-HISTORY) }}
              onChange={(fn, arg) => update(fn(latest.current, l.id, arg), fn !== setText)}
              onOpen={(line, clips) => setSheet({ id: line.id, clips })}
            />
          ))}
        </div>
      </Panel>

      <Panel title={copy.editing.unusedTitle} intro={copy.editing.unusedIntro}>
        {!script.unmatched?.length && <p className="text-sm text-white/50">{copy.editing.unusedNone}</p>}
        <ul className="space-y-2">
          {(script.unmatched ?? []).map((c) => (
            <li key={c.clip_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              {c.thumb && <img src={c.thumb} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />}
              <span className="min-w-0 flex-1 break-words">{c.name}</span>
              <span className="text-white/50">{clock(c.clip_s)}</span>
              <button type="button" className={tool} onClick={() => update(appendUnmatched(latest.current, c.clip_id, copy.editing.newLineText(c.name)))}>{copy.editing.addAtEnd}</button>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="glass-bar sticky bottom-0 z-10 -mx-4 border-t px-4 py-3 sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" className="text-xs text-white/60">{saveLabel}</span>
          {save === 'failed' && <button type="button" className={tool} onClick={() => flush().catch(() => {})}>{copy.editing.saveRetry}</button>}
          <button type="button" className={tool} disabled={!history.current.length} onClick={undo}>{copy.editing.undo}</button>
          <Button className="ml-auto min-h-11" disabled={submit.busy || blocked || !lines.length} onClick={onSubmit}>
            {submit.busy ? copy.editing.submitting : copy.editing.submit}
          </Button>
        </div>
        <ToolError error={submit.error} />
      </div>

      <TakeSheet
        line={sheetLine}
        clips={sheet?.clips ? (script.unmatched ?? []) : null}
        onClose={() => setSheet(null)}
        onChoose={(takeId) => update(chooseTake(latest.current, sheet.id, takeId))}
        onTrim={(takeId, t) => update(trimTake(latest.current, sheet.id, takeId, t))}
        onGiveClip={(clipId) => { update(giveClip(latest.current, sheet.id, clipId)); setSheet({ id: sheet.id, clips: false }) }}
      />
    </div>
  )
}
