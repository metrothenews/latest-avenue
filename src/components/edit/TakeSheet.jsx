import { useEffect, useState } from 'react'
import { editFlow as copy } from '../../data/editFlow.js'
import { clipLength, clipName, clock } from '../../lib/editingScript.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { fieldClass } from '../ui/fieldStyles.js'

const nudge = 'glass min-h-11 min-w-11 rounded-xl px-2 text-sm font-semibold text-white'
const round = (n) => Math.round(n * 100) / 100

function TrimField({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-white/60">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <button type="button" className={nudge} aria-label={`${label} ${copy.take.earlier}`} onClick={() => onChange(round(value - 0.1))}>{copy.take.earlier}</button>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={value}
          onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))}
          className={`${fieldClass()} min-w-0 flex-1 text-center`}
        />
        <button type="button" className={nudge} aria-label={`${label} ${copy.take.later}`} onClick={() => onChange(round(value + 0.1))}>{copy.take.later}</button>
      </div>
    </div>
  )
}

// Swap a line's take for one of its ranked alternatives, and trim what plays.
export default function TakeSheet({ doc, line, thumbs, busy, onClose, onChoose, onTrim }) {
  const [cut, setCut] = useState(null)
  useEffect(() => { setCut(line?.cut ? { in: line.cut.in, out: line.cut.out } : null) }, [line?.cut?.clip, line?.cut?.in, line?.cut?.out]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!line) return null

  const takes = line.takes ?? []
  const max = line.cut ? clipLength(doc, line.cut.clip) ?? Infinity : Infinity
  const set = (k, v) => setCut((c) => {
    const next = { ...c, [k]: Math.max(0, Math.min(v, max)) }
    if (next.out - next.in < 0.1) return c
    return next
  })
  const changed = cut && line.cut && (cut.in !== line.cut.in || cut.out !== line.cut.out)

  return (
    <Modal open onClose={onClose} title={copy.take.title}>
      <ul className="space-y-2">
        {takes.map((t, i) => {
          const inUse = i === line.take
          return (
            <li key={`${t.clip}-${i}`}>
              <button
                type="button"
                aria-pressed={inUse}
                disabled={busy}
                onClick={() => !inUse && onChoose(i)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm disabled:opacity-60 ${inUse ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
              >
                {thumbs?.[i] && <img src={thumbs[i]} alt="" className="h-12 w-20 shrink-0 rounded-md bg-black object-cover" />}
                <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{copy.editing.takeOf(i + 1, takes.length)}</span>
                  {i === 0 && <span className="rounded-full border border-white/15 px-2 text-xs text-white/60">{copy.take.best}</span>}
                  {t.score != null && <span className="text-xs text-white/50">{copy.take.match(Math.round(t.score * 100))}</span>}
                  {inUse && <span className="rounded-full border border-blue-300/40 px-2 text-xs text-blue-100/80">{copy.take.inUse}</span>}
                </span>
                <span className="mt-1 block break-all text-white/60">{clipName(doc, t.clip)}</span>
                <span className="block text-white/50">{clock(t.in)} → {clock(t.out)}</span>
                {t.heard && <span className="mt-1 block break-words text-xs text-white/40">{copy.take.heard} “{t.heard}”</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {cut && !line.music && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold">{copy.take.trim}</h3>
          <div className="mt-3 grid gap-4">
            <TrimField id="trim-in" label={copy.take.in} value={cut.in} onChange={(v) => set('in', v)} />
            <TrimField id="trim-out" label={copy.take.out} value={cut.out} onChange={(v) => set('out', v)} />
          </div>
          <p className="mt-2 text-sm text-white/60">{copy.take.length(clock(cut.out - cut.in))}</p>
          <div className="mt-3"><Button variant="secondary" className="min-h-11" disabled={!changed || busy} onClick={() => onTrim(cut.in, cut.out)}>{copy.take.applyTrim}</Button></div>
        </div>
      )}
      <div className="mt-6"><Button className="min-h-11" onClick={onClose}>{copy.take.done}</Button></div>
    </Modal>
  )
}
