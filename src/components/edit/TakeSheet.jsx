import { editFlow as copy } from '../../data/editFlow.js'
import { chosenTake, clock } from '../../lib/editingScript.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { fieldClass } from '../ui/fieldStyles.js'

const nudge = 'glass min-h-11 min-w-11 rounded-xl px-2 text-sm font-semibold text-white'

function TrimField({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-white/60">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <button type="button" className={nudge} aria-label={`${label} ${copy.take.earlier}`} onClick={() => onChange(value - 0.1)}>{copy.take.earlier}</button>
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
        <button type="button" className={nudge} aria-label={`${label} ${copy.take.later}`} onClick={() => onChange(value + 0.1)}>{copy.take.later}</button>
      </div>
    </div>
  )
}

function Thumb({ src }) {
  if (!src) return null
  return <img src={src} alt="" className="h-12 w-20 shrink-0 rounded-md object-cover" />
}

// Choose between a line's takes and trim the one in use. With `clips` set instead (a line with
// no footage), choose one of the unused clips.
export default function TakeSheet({ line, clips, onClose, onChoose, onTrim, onGiveClip }) {
  if (!line) return null
  if (clips) {
    return (
      <Modal open onClose={onClose} title={copy.take.pickClip}>
        {!clips.length && <p className="text-sm text-white/50">{copy.editing.unusedNone}</p>}
        <ul className="space-y-2">
          {clips.map((c) => (
            <li key={c.clip_id}>
              <button type="button" onClick={() => onGiveClip(c.clip_id)} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left text-sm hover:border-white/25">
                <Thumb src={c.thumb} />
                <span className="min-w-0 flex-1 break-words">{c.name}</span>
                <span className="shrink-0 text-white/50">{clock(c.clip_s)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    )
  }

  const takes = line.takes ?? []
  const take = chosenTake(line)
  return (
    <Modal open onClose={onClose} title={copy.take.title}>
      <ul className="space-y-2">
        {takes.map((t, i) => {
          const inUse = t.id === line.chosen
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={inUse}
                onClick={() => onChoose(t.id)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm ${inUse ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
              >
                <Thumb src={t.thumb} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold">{copy.editing.takeOf(i + 1, takes.length)}</span>
                    {i === 0 && <span className="rounded-full border border-white/15 px-2 text-xs text-white/60">{copy.take.best}</span>}
                    {t.score != null && <span className="text-xs text-white/50">{copy.take.match(Math.round(t.score * 100))}</span>}
                    {inUse && <span className="rounded-full border border-blue-300/40 px-2 text-xs text-blue-100/80">{copy.take.inUse}</span>}
                  </span>
                  <span className="mt-1 block break-words text-white/60">{t.name}</span>
                  <span className="block text-white/50">{clock(t.in_s)} → {clock(t.out_s)}</span>
                  {t.transcript && <span className="mt-1 block break-words text-xs text-white/40">{copy.take.heard} “{t.transcript}”</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {take && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold">{copy.take.trim}</h3>
          <div className="mt-3 grid gap-4">
            <TrimField id="trim-in" label={copy.take.in} value={take.in_s} onChange={(v) => onTrim(take.id, { in_s: v })} />
            <TrimField id="trim-out" label={copy.take.out} value={take.out_s} onChange={(v) => onTrim(take.id, { out_s: v })} />
          </div>
          <p className="mt-2 text-sm text-white/60">{copy.take.length(clock(take.out_s - take.in_s))}</p>
        </div>
      )}
      <div className="mt-6"><Button className="min-h-11" onClick={onClose}>{copy.take.done}</Button></div>
    </Modal>
  )
}
