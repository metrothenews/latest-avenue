import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import BoardIcon, { IconShapes } from './BoardIcon.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { featuredIcons, iconColors, note } from '../../data/note.js'

const SHOWN = 50 // icons offered at once: the featured ones, or the best matches for a search
// "ChartNoAxesColumn" → "chart no axes column"
const words = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').toLowerCase()

// Lucide's icons (open source, ISC licence), loaded only when the picker opens:
// [{ name, label, shapes: [{ tag, …attributes }] }], one entry per distinct icon.
let library
function loadIcons() {
  library ??= import('lucide').then(({ icons }) => {
    // Some icons go by several names (old names are kept as aliases). Show each drawing once,
    // under its featured name if it has one, otherwise its shortest.
    const rank = new Map(featuredIcons.map((label, i) => [label, i]))
    const byDrawing = new Map()
    for (const [name, node] of Object.entries(icons)) {
      const label = words(name)
      const kept = byDrawing.get(node)
      const better = !kept || (rank.has(label) && !rank.has(kept.label)) || (rank.has(label) === rank.has(kept.label) && label.length < kept.label.length)
      if (better) byDrawing.set(node, { name, label, shapes: node.map(([tag, attrs]) => ({ tag, ...attrs })) })
    }
    const all = [...byDrawing.values()]
    // The handy ones first, in the order given; then everything else, alphabetically.
    return all.sort((a, b) => (rank.get(a.label) ?? 1e6) - (rank.get(b.label) ?? 1e6) || a.label.localeCompare(b.label))
  })
  return library
}

// Choose a board's icon and the icon's colour. `board`: the board being changed, or null when closed.
// onChange({ icon, iconColor }) saves straight away; the picker stays open to try others.
export default function IconPicker({ board, onChange, onClose }) {
  const [icons, setIcons] = useState(null)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const open = Boolean(board)

  useEffect(() => {
    if (!open) return
    setSearch('')
    loadIcons().then(setIcons, () => setFailed(true))
  }, [open])

  const found = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean)
    // Nothing typed: just the featured icons. Otherwise search everything; names that start with
    // what was typed come first.
    if (!terms.length) return (icons ?? []).slice(0, featuredIcons.length)
    const starts = (icon) => (icon.label.startsWith(terms[0]) ? 0 : 1)
    return (icons ?? []).filter((icon) => terms.every((t) => icon.label.includes(t))).sort((a, b) => starts(a) - starts(b))
  }, [icons, search])

  return (
    <Modal open={open} onClose={onClose} title={note.iconTitle} width="max-w-2xl">
      {board && (
        <>
          <label htmlFor="icon-search" className="sr-only">{note.iconSearch}</label>
          <input id="icon-search" type="search" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={note.iconSearch} className={fieldClass(false)} />

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <BoardIcon board={board} />
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs text-white/50">{note.iconColor}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={note.iconColor}>
                {iconColors.map((c) => (
                  <button
                    key={c.key} type="button" role="radio" aria-checked={(board.iconColor ?? 'auto') === c.key} aria-label={c.label} title={c.label}
                    onClick={() => onChange({ iconColor: c.key === 'auto' ? null : c.key })}
                    className={`h-7 w-7 rounded-full border ${c.swatch} ${(board.iconColor ?? 'auto') === c.key ? 'border-white ring-2 ring-white' : 'border-white/30'}`}
                  >{c.key === 'auto' && <span className="text-[10px] font-bold text-white">A</span>}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 max-h-72 min-h-[8rem] overflow-y-auto pr-1">
            {failed && <p className="text-sm text-red-300/90" role="alert">{note.iconFailed}</p>}
            {!icons && !failed && <p className="text-sm text-white/50">Loading icons…</p>}
            {icons && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
                {!search && (
                  <button type="button" onClick={() => onChange({ icon: null })} aria-pressed={!board.icon} title={note.iconNone} aria-label={note.iconNone} className={`flex h-11 items-center justify-center rounded-lg text-xs hover:bg-white/10 ${board.icon ? 'text-white/60' : 'bg-white/15 text-white'}`}>None</button>
                )}
                {found.slice(0, SHOWN).map((icon) => (
                  <button
                    key={icon.name} type="button" title={icon.label} aria-label={icon.label} aria-pressed={board.icon?.name === icon.name}
                    onClick={() => onChange({ icon: { name: icon.name, shapes: icon.shapes } })}
                    className={`flex h-11 items-center justify-center rounded-lg hover:bg-white/10 ${board.icon?.name === icon.name ? 'bg-white/15 text-white' : 'text-white/80'}`}
                  ><IconShapes shapes={icon.shapes} /></button>
                ))}
              </div>
            )}
            {icons && found.length === 0 && <p className="mt-2 text-sm text-white/50">{note.iconNoMatch}</p>}
            {icons && found.length > SHOWN && <p className="mt-3 text-xs text-white/40">Showing {SHOWN} of {found.length}. {note.iconMore}</p>}
            {icons && !search && <p className="mt-3 text-xs text-white/40">{note.iconHint}</p>}
          </div>
          <p className="mt-3 text-xs text-white/40">{note.iconCredit}</p>
        </>
      )}
    </Modal>
  )
}
