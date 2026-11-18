import { editFlow as copy } from '../../data/editFlow.js'
import { startAssembly } from '../../lib/editProject.js'
import Button from '../ui/Button.jsx'
import { Bar, Panel, Status, ToolError, useAction } from './parts.jsx'

const STAGES = Object.keys(copy.assembly.stages)

// Step 3: build the assembly cut, and show how it's going (the page polls the project).
export default function AssemblyStep({ project, call, onProject, onNext, blocked }) {
  const a = project.assembly ?? { state: 'idle' }
  const { busy, error, act } = useAction()
  const build = () => act(async () => onProject(await call(startAssembly)))
  const current = STAGES.indexOf(a.stage)

  return (
    <Panel title={copy.assembly.title} intro={a.state === 'idle' ? copy.assembly.intro : ''}>
      {a.state === 'idle' && <Button className="min-h-11" disabled={busy || blocked} onClick={build}>{copy.assembly.build}</Button>}

      {a.state === 'running' && (
        <div>
          <Status>{copy.assembly.running}</Status>
          <ol className="mt-4 space-y-2 text-sm">
            {STAGES.map((s, i) => {
              const state = current < 0 ? 'todo' : i < current ? 'done' : i === current ? 'now' : 'todo'
              return (
                <li key={s} className="flex items-center gap-3" aria-current={state === 'now' ? 'step' : undefined}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${state === 'done' ? 'border-white/40 bg-white/20' : state === 'now' ? 'border-blue-300/70' : 'border-white/15'}`}>{state === 'done' ? '✓' : ''}</span>
                  <span className={state === 'todo' ? 'text-white/40' : 'text-white'}>{copy.assembly.stages[s]}</span>
                </li>
              )
            })}
          </ol>
          <Bar value={a.progress} />
          {a.message && <p className="mt-2 break-words text-sm text-white/50">{a.message}</p>}
          <p className="mt-4 text-xs text-white/50">{copy.assembly.leave}</p>
        </div>
      )}

      {a.state === 'done' && (
        <div>
          <Status>{copy.assembly.done}</Status>
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
