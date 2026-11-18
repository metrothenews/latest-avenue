import { useState } from 'react'
import { editFlow as copy } from '../../data/editFlow.js'
import Button from '../ui/Button.jsx'

// Small shared pieces of the /edit flow.

export function Panel({ title, intro, children }) {
  return (
    <section className="glass p-5 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {intro && <p className="mt-2 text-sm leading-relaxed text-white/60">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

// An honest message for a failed editor call (see EditToolError in lib/editProject.js).
export function ToolError({ error, onRetry }) {
  if (!error) return null
  const kind = error.kind
  let title = copy.failed
  let body = error.message
  if (kind === 'notBuilt') [title, body] = [copy.notBuilt.title, copy.notBuilt.body]
  else if (kind === 'unreachable') [title, body] = [copy.editor.unreachable, '']
  else if (kind === 'denied') [title, body] = [copy.editor.denied, '']
  else if (kind === 'drive') [title, body] = [error.message, '']
  return (
    <div role="alert" className="mt-4 rounded-lg border border-white/15 bg-white/5 p-4 text-sm">
      <p className="font-semibold text-white">{title}</p>
      {body && <p className="mt-1 break-words text-white/60">{body}</p>}
      {kind === 'notBuilt' && <div className="mt-3"><Button variant="secondary" to="/edit/sequencer" className="min-h-11">{copy.sequencer.open}</Button></div>}
      {onRetry && kind !== 'notBuilt' && kind !== 'denied' && <div className="mt-3"><Button variant="secondary" className="min-h-11" onClick={onRetry}>{copy.editor.retry}</Button></div>}
    </div>
  )
}

// A big tappable choice (radio-like card).
export function Choice({ title, help, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`w-full rounded-xl border p-4 text-left disabled:opacity-50 ${selected ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
    >
      <span className="block text-sm font-semibold text-white">{title}</span>
      {help && <span className="mt-1 block text-sm text-white/55">{help}</span>}
    </button>
  )
}

// A plain progress bar (no animation). `value` 0..1, or null for "no figure yet".
export function Bar({ value }) {
  if (value == null) return null
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-blue-400/70" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-right text-xs text-white/50">{pct}%</p>
    </div>
  )
}

export function Status({ children }) {
  return <p role="status" className="text-sm text-white/70">{children}</p>
}

// Runs one async step action at a time and keeps its error for <ToolError>.
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const act = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, act }
}

// A Drive token problem as a <ToolError>-shaped error.
export const driveError = (err) =>
  Object.assign(new Error(err?.kind === 'auth' ? copy.footage.expired : (err?.message ?? String(err))), { kind: 'drive', auth: err?.kind === 'auth' })
