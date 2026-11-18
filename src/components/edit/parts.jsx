import { useEffect, useRef, useState } from 'react'
import { jobStatus } from '../../lib/editProject.js'
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

// Messages from the editor that read like program output rather than a sentence for a person.
const technical = (m) => /Error:|Traceback|Exception|errno|\bat 0x|https?:\/\//.test(m) || m.length > 180

// Drive refused the token: it ran out or was revoked. The fix is to connect again.
export const isDriveAuth = (m) => /\b401\b|invalid (authentication|credentials)|unauthenticated|token (has )?expired|invalid_grant/i.test(m ?? '')

// An honest message for a failed editor call (see EditToolError in lib/editProject.js).
// onRetry adds "Try again"; onReconnect adds "Connect Google Drive" when Drive refused.
export function ToolError({ error, onRetry, onReconnect }) {
  if (!error) return null
  const kind = error.kind
  const message = String(error.message ?? '')
  let title = copy.failed
  let body = message
  let details = ''
  if (kind === 'notBuilt') [title, body] = [copy.notBuilt.title, copy.notBuilt.body]
  else if (kind === 'unreachable') [title, body] = [copy.editor.unreachable, copy.editor.unreachableHelp]
  else if (kind === 'denied') [title, body] = [copy.editor.denied, '']
  else if (kind === 'drive') [title, body] = [message, '']
  else if (kind === 'gone') [title, body] = [copy.gone, '']
  else if (isDriveAuth(message)) [title, body] = [copy.footage.expired, '']
  else if (technical(message)) [title, body, details] = [copy.failedPlain, copy.failedPlainHelp, message]
  const reconnect = onReconnect && (error.auth || isDriveAuth(message))
  return (
    <div role="alert" className="mt-4 rounded-lg border border-white/15 bg-white/5 p-4 text-sm">
      <p className="font-semibold text-white">{title}</p>
      {body && <p className="mt-1 break-words text-white/60">{body}</p>}
      {details && (
        <details className="mt-2 text-white/50">
          <summary className="flex min-h-11 cursor-pointer items-center">{copy.details}</summary>
          <p className="break-words font-mono text-xs">{details}</p>
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-2 empty:hidden">
        {kind === 'notBuilt' && <Button variant="secondary" to="/edit/sequencer" className="min-h-11">{copy.sequencer.open}</Button>}
        {reconnect && <Button className="min-h-11" onClick={onReconnect}>{copy.footage.connect}</Button>}
        {onRetry && !reconnect && kind !== 'notBuilt' && kind !== 'denied' && <Button variant="secondary" className="min-h-11" onClick={onRetry}>{copy.editor.retry}</Button>}
      </div>
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

// Follows an editor background job (fetch_drive_folder, start_assembly, upload_to_drive) until it
// ends, then calls onEnd(status) once. -> { status, error } (status: the latest job_status).
export function useJob(call, job, onEnd) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const end = useRef(onEnd)
  end.current = onEnd
  useEffect(() => {
    if (!job) return undefined
    let stop = false
    let timer
    setStatus(null)
    setError(null)
    const tick = async () => {
      try {
        const s = await call(jobStatus, job)
        if (stop) return
        setStatus(s)
        setError(null)
        if (s.state !== 'running') return end.current(s)
      } catch (err) {
        if (stop) return
        setError(err)
        if (err.kind !== 'unreachable') return end.current({ state: 'failed', error: err })
      }
      timer = setTimeout(tick, 1500)
    }
    tick()
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [call, job])
  return { status, error }
}

// The last thing a job said, for showing progress.
export const lastLog = (status) => status?.log?.filter(Boolean).at(-1) ?? ''
