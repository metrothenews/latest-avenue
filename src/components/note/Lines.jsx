import LineEdit from './LineEdit.jsx'
import { lineShape, liveLine } from '../../lib/noteGeometry.js'
import { colorOf } from '../../data/note.js'

const handle = 'fill-white stroke-neutral-900 cursor-grab touch-none'

// The lines and arrows on a board, drawn over the cards. A selected line shows a handle on each
// end (drag onto a card to attach it) and one in the middle (drag to curve it).
export default function Lines({ lines, rects, width, height, selection, drag, editing, valueRef, canEdit, onLineDown, onEndDown, onBendDown, onLabelEdit }) {
  const shapes = lines.map((line) => ({ line, shape: lineShape(liveLine(line, drag), rects) }))
  return (
    <>
      <svg width={width} height={height} className="pointer-events-none absolute left-0 top-0 z-[150000] overflow-visible">
        {shapes.map(({ line, shape }) => {
          const on = selection.includes(line.id)
          return (
            <g key={line.id} data-card-id={line.id} data-line="" className={colorOf(line.color).line}>
              {/* A wide invisible stroke makes the line easy to grab. */}
              <path d={shape.path} fill="none" stroke="transparent" strokeWidth="16" className={canEdit ? 'pointer-events-auto cursor-grab touch-none' : ''} onPointerDown={(e) => onLineDown(e, line)} onDoubleClick={(e) => { e.stopPropagation(); if (canEdit) onLabelEdit(line) }} />
              {on && <path d={shape.path} fill="none" stroke="white" strokeOpacity="0.35" strokeWidth={(line.weight ?? 2) * 1.5 + 6} strokeLinecap="round" />}
              <path d={shape.path} fill="none" stroke="currentColor" strokeWidth={(line.weight ?? 2) * 1.5} strokeLinecap="round" strokeDasharray={line.dashed ? `${(line.weight ?? 2) * 4} ${(line.weight ?? 2) * 4}` : undefined} />
              {shape.heads.map((points) => <polygon key={points} points={points} fill="currentColor" />)}
              {on && canEdit && (
                <g className="pointer-events-auto">
                  <circle cx={shape.a.x} cy={shape.a.y} r="6" strokeWidth="2" className={handle} onPointerDown={(e) => onEndDown(e, line, 'from')} />
                  <circle cx={shape.b.x} cy={shape.b.y} r="6" strokeWidth="2" className={handle} onPointerDown={(e) => onEndDown(e, line, 'to')} />
                  <circle cx={shape.mid.x} cy={shape.mid.y} r="5" strokeWidth="2" className={`${handle} opacity-70`} onPointerDown={(e) => onBendDown(e, line, shape)} />
                </g>
              )}
            </g>
          )
        })}
      </svg>
      {shapes.map(({ line, shape }) => (editing === line.id || line.label) && (
        <div
          key={line.id}
          className="absolute z-[150001] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-semibold text-white shadow"
          style={{ left: shape.mid.x, top: shape.mid.y - (selection.includes(line.id) && editing !== line.id ? 18 : 0) }}
          onPointerDown={(e) => { if (editing !== line.id) onLineDown(e, line) }}
          onDoubleClick={(e) => { e.stopPropagation(); if (canEdit) onLabelEdit(line) }}
        >
          {editing === line.id ? <LineEdit value={line.label} field="label" valueRef={valueRef} placeholder="Label" className="w-32 text-center" /> : line.label}
        </div>
      ))}
    </>
  )
}
