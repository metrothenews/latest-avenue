import { useEffect, useState } from 'react'
import { editFlow as copy } from '../../data/editFlow.js'
import { clipName, soundFiles } from '../../lib/editingScript.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { fieldClass } from '../ui/fieldStyles.js'

const nudge = 'glass min-h-11 rounded-xl px-3 text-sm font-semibold text-white'
const FRAME = 0.04

// Pair a camera clip with a sound file at an offset, or go back to the camera's own sound.
export default function SyncSheet({ doc, clip, busy, onClose, onSave, onCamera }) {
  const files = soundFiles(doc)
  const current = clip ? doc.media?.[clip]?.sound : null
  const [audio, setAudio] = useState('')
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    setAudio(current?.clip ?? files[0]?.id ?? '')
    setOffset(current?.offset ?? 0)
  }, [clip]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!clip) return null
  const t = copy.editing.sync
  const move = (by) => setOffset((o) => Math.round((o + by) * 1000) / 1000)

  return (
    <Modal open onClose={onClose} title={t.title}>
      <p className="break-words text-sm text-white/60">{t.intro(clipName(doc, clip))}</p>
      {!files.length && <p className="mt-4 text-sm text-white/60">{t.noRecorder}</p>}
      {files.length > 0 && (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="sync-audio" className="text-xs text-white/60">{t.recorder}</label>
            <select id="sync-audio" value={audio} onChange={(e) => setAudio(e.target.value)} className={`${fieldClass()} mt-1 min-h-11`}>
              {files.map((f) => <option key={f.id} value={f.id} className="bg-neutral-900">{f.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sync-offset" className="text-xs text-white/60">{t.offset}</label>
            <input
              id="sync-offset"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={offset}
              onChange={(e) => e.target.value !== '' && setOffset(Number(e.target.value))}
              className={`${fieldClass()} mt-1 text-center`}
            />
            <div className="mt-2 grid grid-cols-4 gap-2">
              <button type="button" className={nudge} onClick={() => move(-1)}>{t.secondBack}</button>
              <button type="button" className={nudge} onClick={() => move(-FRAME)}>{t.frameBack}</button>
              <button type="button" className={nudge} onClick={() => move(FRAME)}>{t.frameOn}</button>
              <button type="button" className={nudge} onClick={() => move(1)}>{t.secondOn}</button>
            </div>
            <p className="mt-2 text-xs text-white/50">{t.offsetHelp}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={busy || !audio} onClick={() => onSave(audio, offset)}>{t.save}</Button>
          </div>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        {current && <Button variant="secondary" className="min-h-11" disabled={busy} onClick={onCamera}>{t.camera}</Button>}
        <Button variant="secondary" className="min-h-11" onClick={onClose}>{copy.take.done}</Button>
      </div>
    </Modal>
  )
}
