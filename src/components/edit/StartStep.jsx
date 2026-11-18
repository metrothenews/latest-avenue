import { useState } from 'react'
import { editFlow as copy } from '../../data/editFlow.js'
import { startProject } from '../../lib/editProject.js'
import Button from '../ui/Button.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { Panel, ToolError, useAction } from './parts.jsx'

// No project yet, or the person asked to start over.
export default function StartStep({ project, call, onProject, onCarryOn, blocked }) {
  const [name, setName] = useState('')
  const { busy, error, act } = useAction()
  const create = (e) => {
    e.preventDefault()
    act(async () => onProject(await call(startProject, { name: name.trim() })))
  }
  return (
    <Panel title={copy.start.title} intro={copy.start.intro}>
      {project && (
        <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">{copy.start.current}</p>
          <p className="mt-1 break-words font-semibold">{project.name}</p>
          <div className="mt-3"><Button className="min-h-11" onClick={onCarryOn}>{copy.start.carryOn}</Button></div>
        </div>
      )}
      <form onSubmit={create}>
        <label htmlFor="edit-name" className="text-sm text-white/70">{copy.start.nameLabel}</label>
        <input
          id="edit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.start.namePlaceholder}
          maxLength={120}
          autoComplete="off"
          className={`${fieldClass()} mt-2`}
        />
        {project && <p className="mt-2 text-xs text-white/50">{copy.start.keptNote}</p>}
        <div className="mt-4">
          <Button type="submit" variant={project ? 'secondary' : 'primary'} className="min-h-11" disabled={busy || blocked || !name.trim()}>
            {project ? copy.start.startNew : copy.start.create}
          </Button>
        </div>
      </form>
      <ToolError error={error} />
    </Panel>
  )
}
