import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/layout/Logo.jsx'
import Button from '../components/ui/Button.jsx'
import { useAuth } from '../components/auth/AuthProvider.jsx'
import { editFlow as copy } from '../data/editFlow.js'
import { editConfigured, getEditStatus } from '../lib/editStream.js'
import { getProject } from '../lib/editProject.js'
import { clearDriveToken, connectDrive, getDriveToken } from '../lib/driveAuth.js'
import { ToolError, Status } from '../components/edit/parts.jsx'
import StartStep from '../components/edit/StartStep.jsx'
import FootageStep from '../components/edit/FootageStep.jsx'
import ScriptStep from '../components/edit/ScriptStep.jsx'
import AssemblyStep from '../components/edit/AssemblyStep.jsx'
import EditingStep from '../components/edit/EditingStep.jsx'
import ExportStep, { SequencerStep } from '../components/edit/ExportStep.jsx'

const START_TIMEOUT_MS = 120000
const RETRY_MS = 2500
const POLL_MS = 3000

// Which steps can be opened, given what the editor has done so far.
function reachable(p) {
  return {
    footage: Boolean(p),
    script: p?.footage?.state === 'ready',
    assembly: p?.script?.state === 'ready',
    editing: p?.assembly?.state === 'done',
    sequencer: Boolean(p),
    export: Boolean(p),
  }
}

// Where to land: the first step that isn't finished.
function nextStep(p) {
  if (!p) return 'start'
  if (p.footage?.state !== 'ready') return 'footage'
  if (p.script?.state !== 'ready') return 'script'
  if (p.assembly?.state !== 'done') return 'assembly'
  return 'editing'
}

const working = (p) =>
  p && (p.footage?.state === 'reading' || p.script?.state === 'reading' || p.assembly?.state === 'running' || p.export?.state === 'running')

function StepBar({ step, open, onGo }) {
  const steps = copy.steps
  const i = steps.findIndex((s) => s.id === step)
  return (
    <nav aria-label="Steps" className="mb-6">
      <p className="mb-2 text-xs text-white/50 sm:hidden">
        {i >= 0 ? `${copy.stepOf(i + 1, steps.length)} · ${steps[i].label}` : ''}
      </p>
      <ol className="grid grid-cols-6 gap-1.5">
        {steps.map((s, n) => {
          const here = s.id === step
          const done = i >= 0 && n < i
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!open[s.id]}
                onClick={() => onGo(s.id)}
                aria-current={here ? 'step' : undefined}
                aria-label={`${copy.stepOf(n + 1, steps.length)}: ${s.label}`}
                className="group flex min-h-11 w-full flex-col justify-center gap-1.5 text-left disabled:cursor-not-allowed"
              >
                <span className={`block h-1.5 w-full rounded-full ${here ? 'bg-blue-300/80' : done ? 'bg-white/40' : open[s.id] ? 'bg-white/20' : 'bg-white/10'}`} />
                <span className={`hidden truncate text-xs sm:block ${here ? 'text-white' : open[s.id] ? 'text-white/60' : 'text-white/30'}`}>{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// /edit (owner only): the guided path from footage to a finished cut. See docs/edit-design.md.
// The sequencer itself (the live view) is at /edit/sequencer.
export default function EditProject() {
  const { user } = useAuth()
  const [editor, setEditor] = useState(editConfigured ? 'starting' : 'notDeployed')
  const [project, setProject] = useState(undefined) // undefined: not loaded yet; null: none
  const [loadError, setLoadError] = useState(null)
  const [view, setView] = useState(null)            // the step showing; null until the project loads
  const [driveToken, setDriveToken] = useState(getDriveToken)
  const run = useRef(0)

  const call = useCallback(async (fn, ...args) => fn(await user.getIdToken(), ...args), [user])

  const load = useCallback(async () => {
    try {
      setProject(await call(getProject))
      setLoadError(null)
    } catch (err) {
      setLoadError(err)
    }
  }, [call])

  // Wake the editor (it's off when unused), then load its project.
  const wake = useCallback(async () => {
    if (!editConfigured) return
    const mine = ++run.current
    setEditor('starting')
    const started = Date.now()
    for (;;) {
      try {
        const status = await getEditStatus(await user.getIdToken())
        if (mine !== run.current) return
        if (status.editor_ready) break
      } catch (err) {
        if (mine !== run.current) return
        if (err.denied) return setEditor('denied')
      }
      if (Date.now() - started > START_TIMEOUT_MS) return setEditor('unreachable')
      await new Promise((r) => setTimeout(r, RETRY_MS))
      if (mine !== run.current) return
    }
    setEditor('ready')
    load()
  }, [user, load])

  useEffect(() => {
    wake()
    return () => { run.current++ }
  }, [wake])

  // While the editor is working on something, check on it every few seconds.
  useEffect(() => {
    if (!working(project)) return
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [project, load])

  const drive = {
    token: driveToken,
    connect: async () => setDriveToken(await connectDrive()),
    expire: () => { clearDriveToken(); setDriveToken(null) },
  }

  // Land on the first unfinished step, then stay on whatever step is showing until the person
  // moves on (so a step's "done" summary isn't skipped when the editor finishes).
  useEffect(() => {
    if (view == null && project !== undefined) setView(nextStep(project))
  }, [view, project])

  const open = reachable(project)
  const step = view && (view === 'start' || open[view]) ? view : nextStep(project)
  const go = (id) => { setView(id); window.scrollTo(0, 0) }
  const onProject = (p) => { if (p && typeof p === 'object') setProject(p) }
  const blocked = editor !== 'ready'
  const props = { project, call, onProject, drive, blocked }

  const editorNote = {
    starting: copy.editor.starting,
    unreachable: copy.editor.unreachable,
    denied: copy.editor.denied,
    notDeployed: copy.editor.notDeployed,
  }[editor]

  return (
    <div className="min-h-dvh bg-ink">
      <header className="glass-bar sticky top-0 z-20 border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <span className="shrink-0 whitespace-nowrap"><Logo /></span>
          <span className="hidden rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/60 sm:inline">{copy.tag}</span>
          <span className={`h-2 w-2 shrink-0 rounded-full ${editor === 'ready' ? 'bg-white' : 'bg-white/30'}`} aria-hidden="true" />
          <div className="ml-auto flex items-center gap-1">
            <Button variant="secondary" to="/edit/sequencer" className="min-h-11 !px-4 !py-1.5">{copy.sequencerLink}</Button>
            <Link to="/admin" className="inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-sm text-white/60 hover:text-white">{copy.admin}</Link>
          </div>
        </div>
      </header>

      {editorNote && (
        <div className="border-b border-white/10 bg-white/[0.03]">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3 text-sm text-white/70" role="status">
            <span className="min-w-0 flex-1">{editorNote}</span>
            {(editor === 'unreachable') && <Button variant="secondary" className="min-h-11" onClick={wake}>{copy.editor.retry}</Button>}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        {project !== undefined && step !== 'start' && <StepBar step={step} open={open} onGo={go} />}

        {project === undefined && (
          loadError
            ? <ToolError error={loadError} onRetry={load} />
            : editor === 'ready' && <Status>{copy.loading}</Status>
        )}

        {project !== undefined && (
          <>
            {step === 'start' && <StartStep {...props} onProject={(p) => { onProject(p); setView('footage') }} onCarryOn={() => setView(nextStep(project))} />}
            {step === 'footage' && <FootageStep {...props} onNext={() => go('script')} />}
            {step === 'script' && <ScriptStep {...props} onNext={() => go('assembly')} />}
            {step === 'assembly' && <AssemblyStep {...props} onNext={() => go('editing')} />}
            {step === 'editing' && <EditingStep {...props} onBack={() => go('script')} />}
            {step === 'sequencer' && <SequencerStep />}
            {step === 'export' && <ExportStep {...props} />}
            {project && step !== 'start' && (
              <p className="mt-8 text-center text-xs text-white/40">
                {project.name} · <button type="button" className="min-h-11 underline-offset-2 hover:text-white/70 hover:underline" onClick={() => go('start')}>{copy.start.startNew}</button>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
