import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { IconShapes } from './BoardIcon.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { featuredIcons, note } from '../../data/note.js'

const SHOWN = 50 // icons offered at once: the featured ones, or the best matches for a search
const WIDTH = 296
const GAP = 10
// "ChartNoAxesColumn" → "chart no axes column"
const words = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').toLowerCase()

// Lucide's icons (open source, ISC licence), loaded only when the menu first opens:
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
    // The handy ones first, in the order given; then everything else, alphabetically.
    return [...byDrawing.values()].sort((a, b) => (rank.get(a.label) ?? 1e6) - (rank.get(b.label) ?? 1e6) || a.label.localeCompare(b.label))
  })
  return library
}

// Where to put the menu and how tall it may be: beside the board's tile if there's room,
// otherwise under or over it (whichever has more room, shrinking to fit), always on screen.
// The visible height is used, so on a phone it stays clear of the on-screen keyboard.
function place(tile, height) {
  const vw = window.innerWidth
  const vh = window.visualViewport?.height ?? window.innerHeight
  const clamp = (v, max) => Math.max(8, Math.min(v, max - 8))
  if (!tile) return { left: clamp(vw - WIDTH, vw - WIDTH), top: 96, maxHeight: vh - 104 }
  const beside = { top: clamp(tile.top, vh - Math.min(height, vh - 16)), maxHeight: vh - 16 }
  if (tile.right + GAP + WIDTH <= vw - 8) return { left: tile.right + GAP, ...beside }
  if (tile.left - GAP - WIDTH >= 8) return { left: tile.left - GAP - WIDTH, ...beside }
  const left = clamp(tile.left + tile.width / 2 - WIDTH / 2, vw - WIDTH)
  const below = vh - tile.bottom - GAP - 8
  const above = tile.top - GAP - 8
  if (below >= Math.min(height, 220) || below >= above) return { left, top: tile.bottom + GAP, maxHeight: Math.max(140, below) }
  const tall = Math.min(height, Math.max(140, above))
  return { left, top: Math.max(8, tile.top - GAP - tall), maxHeight: Math.max(140, above) }
}

// A small menu beside a board's tile for choosing its icon, shown while the board's name is being
// edited. (The icon's colour comes from the theme of the board the tile is on.) It never takes the keyboard away from the name by itself; the
// search box is there to click into. `anchorId`: the board's card; onChange({ icon }) saves
// straight away.
export default function IconMenu({ board, anchorId, onChange }) {
  const [icons, setIcons] = useState(null)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [spot, setSpot] = useState(null)
  const menu = useRef(null)

  useEffect(() => {
    loadIcons().then(setIcons, () => setFailed(true))
  }, [])

  // Stay beside the tile as the board scrolls, zooms or the window changes.
  useLayoutEffect(() => {
    const move = () => {
      const tile = document.querySelector(`[data-card-id="${anchorId}"]`)?.getBoundingClientRect()
      setSpot(place(tile, menu.current?.scrollHeight ?? 320))
    }
    move()
    window.addEventListener('resize', move)
    window.visualViewport?.addEventListener('resize', move)
    document.addEventListener('scroll', move, true)
    return () => {
      window.removeEventListener('resize', move)
      window.visualViewport?.removeEventListener('resize', move)
      document.removeEventListener('scroll', move, true)
    }
  }, [anchorId, icons, search])

  const found = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean)
    // Nothing typed: just the featured icons. Otherwise search everything; names that start with
    // what was typed come first.
    if (!terms.length) return (icons ?? []).slice(0, featuredIcons.length)
    const starts = (icon) => (icon.label.startsWith(terms[0]) ? 0 : 1)
    return (icons ?? []).filter((icon) => terms.every((t) => icon.label.includes(t))).sort((a, b) => starts(a) - starts(b))
  }, [icons, search])

  // Pressing a button mustn't take the keyboard away from the board's name.
  const keepFocus = (e) => e.preventDefault()
  return (
    <section
      ref={menu} aria-label={note.iconTitle} data-icon-menu=""
      className="glass fixed z-[55] flex flex-col bg-neutral-900/95 p-3 shadow-xl shadow-black/50"
      style={{ width: WIDTH, left: spot?.left ?? -9999, top: spot?.top ?? 0, maxHeight: spot?.maxHeight }}
    >
      <label htmlFor="icon-search" className="sr-only">{note.iconSearch}</label>
      <input id="icon-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={note.iconSearch} className={`${fieldClass(false)} shrink-0 !px-3 !py-2`} />

      <div className="mt-3 max-h-52 min-h-[2.5rem] flex-1 overflow-y-auto pr-0.5">
        {failed && <p className="text-sm text-red-300/90" role="alert">{note.iconFailed}</p>}
        {!icons && !failed && <p className="text-sm text-white/50">Loading icons…</p>}
        {icons && (
          <div className="grid grid-cols-6 gap-1">
            {!search && (
              <button type="button" onPointerDown={keepFocus} onClick={() => onChange({ icon: null })} aria-pressed={!board.icon} title={note.iconNone} aria-label={note.iconNone} className={`flex h-10 items-center justify-center rounded-lg text-[11px] hover:bg-white/10 ${board.icon ? 'text-white/60' : 'bg-white/15 text-white'}`}>None</button>
            )}
            {found.slice(0, SHOWN).map((icon) => (
              <button
                key={icon.name} type="button" title={icon.label} aria-label={icon.label} aria-pressed={board.icon?.name === icon.name}
                onPointerDown={keepFocus} onClick={() => onChange({ icon: { name: icon.name, shapes: icon.shapes } })}
                className={`flex h-10 items-center justify-center rounded-lg hover:bg-white/10 ${board.icon?.name === icon.name ? 'bg-white/15 text-white' : 'text-white/80'}`}
              ><IconShapes shapes={icon.shapes} className="h-5 w-5" /></button>
            ))}
          </div>
        )}
        {icons && found.length === 0 && <p className="text-sm text-white/50">{note.iconNoMatch}</p>}
      </div>
      <p className="mt-2 shrink-0 text-[11px] leading-snug text-white/40">
        {icons && found.length > SHOWN ? `Showing ${SHOWN} of ${found.length}. ${note.iconMore}` : note.iconHint} {note.iconCredit}
      </p>
    </section>
  )
}
