import { useState } from 'react'
import { editFlow as copy } from '../../data/editFlow.js'
import Button from '../ui/Button.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { Choice, Panel } from './parts.jsx'

const newId = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// What are you making, and its name. Nothing is sent to the editor yet.
export default function StartStep({ project, onStart, onCarryOn }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('scripted')
  const create = (e) => {
    e.preventDefault()
    onStart({ id: newId(), name: name.trim(), kind, created: new Date().toISOString() })
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
        <fieldset>
          <legend className="text-sm text-white/70">{copy.start.kindLabel}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {copy.kinds.map((k) => (
              <Choice key={k.id} title={k.label} help={k.help} selected={kind === k.id} onClick={() => setKind(k.id)} />
            ))}
          </div>
        </fieldset>
        <label htmlFor="edit-name" className="mt-6 block text-sm text-white/70">{copy.start.nameLabel}</label>
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
          <Button type="submit" variant={project ? 'secondary' : 'primary'} className="min-h-11" disabled={!name.trim()}>
            {project ? copy.start.startNew : copy.start.create}
          </Button>
        </div>
      </form>
    </Panel>
  )
}
