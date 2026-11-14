import { createElement } from 'react'
import { colorOf, iconColorOf } from '../../data/note.js'

// Only plain SVG shapes and their geometry are drawn, whatever is stored.
const TAGS = new Set(['path', 'circle', 'rect', 'line', 'ellipse', 'polyline', 'polygon'])
const ATTRS = { d: 'd', cx: 'cx', cy: 'cy', r: 'r', rx: 'rx', ry: 'ry', x: 'x', y: 'y', x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', width: 'width', height: 'height', points: 'points' }

// An icon's shapes ([{ tag, …attributes }], as saved on a board) drawn as a line icon.
export function IconShapes({ shapes, className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(shapes ?? []).filter((s) => TAGS.has(s.tag)).map((s, i) => createElement(s.tag, {
        key: i,
        ...Object.fromEntries(Object.entries(s).filter(([k, v]) => ATTRS[k] && (typeof v === 'string' || typeof v === 'number')).map(([k, v]) => [ATTRS[k], String(v).slice(0, 2000)])),
      }))}
    </svg>
  )
}

// A board's tile: a rounded square in the board's colour, holding its icon (or four small squares
// when it has none). `board`: { color, icon: { name, shapes } | null, iconColor }.
export default function BoardIcon({ board, className = 'h-16 w-16 rounded-2xl', glyph = 'h-8 w-8' }) {
  const light = board?.color === 'grey'
  const tint = iconColorOf(board?.iconColor)?.text ?? (light ? 'text-neutral-900' : 'text-white')
  return (
    <span className={`flex shrink-0 items-center justify-center ${className} ${colorOf(board?.color).board} ${tint}`} aria-hidden="true">
      {board?.icon?.shapes?.length
        ? <IconShapes shapes={board.icon.shapes} className={glyph} />
        : <span className="grid grid-cols-2 gap-1 opacity-80">{[0, 1, 2, 3].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-sm bg-current" />)}</span>}
    </span>
  )
}
