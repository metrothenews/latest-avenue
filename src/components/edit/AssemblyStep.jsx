import { editFlow as copy } from '../../data/editFlow.js'
import { editingScriptPath, startAssembly } from '../../lib/editProject.js'
import { clock } from '../../lib/editingScript.js'
import Button from '../ui/Button.jsx'
import { Panel, Status, ToolError, lastLog, useAction, useJob } from './parts.jsx'

// Step 3: build the assembly cut (a background job in the editor) and show how it's going.
export default function AssemblyStep({ project, call, update, onNext, blocked }) {
  const a = project.assembly ?? { state: 'idle' }
  const { busy, error, act } = useAction()
  const script = project.script?.source === 'none' ? null : project.script?.path

  const job = useJob(call, a.state === 'running' ? a.job : null, (s) => {
    if (s.state === 'done') update({ assembly: { ...a, state: 'done', summary: s.result } })
    else update({ assembly: { ...a, state: 'failed', message: s.error?.kind === 'gone' ? copy.gone : (s.error?.message ?? lastLog(s)) } })
  })

  const build = () =>
    act(async () => {
      const started = await call(startAssembly, {
        mediaFolder: project.footage.folder,
        output: editingScriptPath(project),
        script,
        song: project.kind === 'music' ? project.music?.song?.path : undefined,
        lyrics: project.kind === 'music' ? project.music?.lyrics?.path : undefined,
      })
      update({ assembly: { state: 'running', job: started.job, output: started.output }, laidOut: false })
    })

  const sum = a.summary
  return (
    <Panel title={copy.assembly.title} intro={a.state !== 'idle' ? '' : project.kind === 'music' ? copy.assembly.introMusic : script ? copy.assembly.intro : copy.assembly.introNoScript}>
      {a.state === 'idle' && <Button className="min-h-11" disabled={busy || blocked} onClick={build}>{copy.assembly.build}</Button>}

      {a.state === 'running' && (
        <div>
          <Status>{copy.assembly.running}</Status>
          {/* The editor's own progress lines, newest last. */}
          <ul className="mt-4 space-y-1 break-words text-sm text-white/60">
            {(job.status?.log ?? []).slice(-4).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          {job.status?.seconds != null && <p className="mt-3 text-xs text-white/50">{copy.assembly.elapsed(copy.seconds(job.status.seconds))}</p>}
          <p className="mt-4 text-xs text-white/50">{copy.assembly.leave}</p>
        </div>
      )}

      {a.state === 'done' && (
        <div>
          <Status>{copy.assembly.done}</Status>
          {sum && (
            <p className="mt-1 text-sm text-white/60">
              {project.kind === 'music'
                ? copy.assembly.summaryMusic(sum.events ?? 0, clock(sum.duration ?? 0))
                : copy.assembly.summary(sum.lines_with_footage ?? 0, sum.dialogue_lines ?? 0, sum.unplaced?.length ?? 0)}
            </p>
          )}
          <div className="mt-4"><Button className="min-h-11" onClick={onNext}>{copy.assembly.open}</Button></div>
          <div className="mt-6 border-t border-white/10 pt-4">
            <Button variant="secondary" className="min-h-11" disabled={busy || blocked} onClick={build}>{copy.assembly.rebuild}</Button>
            <p className="mt-2 text-xs text-white/50">{copy.assembly.rebuildHelp}</p>
          </div>
        </div>
      )}

      {a.state === 'failed' && (
        <div>
          <ToolError error={{ kind: 'failed', message: a.message || copy.assembly.failed }} />
          <div className="mt-4"><Button className="min-h-11" disabled={busy || blocked} onClick={build}>{copy.assembly.retry}</Button></div>
        </div>
      )}
      <ToolError error={error} />
    </Panel>
  )
}
