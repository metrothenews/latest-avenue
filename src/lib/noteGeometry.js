// Geometry for lines between cards on a note board. All points are in board coordinates.
// rects: Map of card ID → { x, y, w, h } as measured on screen.

const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

// Where a line end sits: the middle of the card it's attached to, or its own free point.
function anchor(end, rects) {
  const rect = end.card ? rects.get(end.card) : null
  return rect ? { ...centre(rect), rect } : { x: end.x, y: end.y, rect: null }
}

// The point where a line leaving a card's middle towards `to` crosses the card's edge (plus a gap).
function edge(at, to, gap = 5) {
  if (!at.rect) return { x: at.x, y: at.y }
  const dx = to.x - at.x
  const dy = to.y - at.y
  if (!dx && !dy) return { x: at.x, y: at.y }
  const scale = Math.min(dx ? (at.rect.w / 2 + gap) / Math.abs(dx) : Infinity, dy ? (at.rect.h / 2 + gap) / Math.abs(dy) : Infinity)
  return scale >= 1 ? { x: at.x, y: at.y } : { x: at.x + dx * scale, y: at.y + dy * scale }
}

function arrowhead(tip, from, size) {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  const wing = (turn) => `${tip.x - size * Math.cos(angle + turn)},${tip.y - size * Math.sin(angle + turn)}`
  return `${tip.x},${tip.y} ${wing(0.42)} ${wing(-0.42)}`
}

// Everything needed to draw a line: { a, b (its two ends), mid (where its label and bend handle
// sit), straightMid, path (SVG), heads (arrowhead polygons) }.
// `bend` is how far the middle of the line has been pulled away from straight.
export function lineShape(line, rects) {
  const from = anchor(line.from, rects)
  const to = anchor(line.to, rects)
  const straightMid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  const bend = line.bend && (line.bend.x || line.bend.y) ? line.bend : null
  // A quadratic curve passes through straightMid + bend when its control point is twice as far out.
  const control = bend ? { x: straightMid.x + bend.x * 2, y: straightMid.y + bend.y * 2 } : null
  const a = edge(from, control ?? to)
  const b = edge(to, control ?? from)
  const mid = control ? { x: a.x / 4 + control.x / 2 + b.x / 4, y: a.y / 4 + control.y / 2 + b.y / 4 } : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const size = 9 + (line.weight ?? 2) * 2
  return {
    a, b, mid, straightMid,
    path: control ? `M${a.x},${a.y}Q${control.x},${control.y} ${b.x},${b.y}` : `M${a.x},${a.y}L${b.x},${b.y}`,
    heads: [line.endArrow && arrowhead(b, control ?? a, size), line.startArrow && arrowhead(a, control ?? b, size)].filter(Boolean),
  }
}

// A line with whatever is being dragged applied, so it follows the pointer before it's saved.
export function liveLine(line, drag) {
  if (!drag) return line
  if (drag.kind === 'end' && drag.lineId === line.id) return { ...line, [drag.which]: { card: drag.over ?? null, x: drag.x, y: drag.y } }
  if (drag.kind === 'bend' && drag.lineId === line.id) return { ...line, bend: { x: drag.bx, y: drag.by } }
  if (drag.kind === 'move' && drag.moved && drag.ids.includes(line.id)) return shiftLine(line, drag.dx, drag.dy)
  return line
}

// A line moved by (dx, dy): only its free ends move; attached ends stay with their cards.
export function shiftLine(line, dx, dy) {
  const shift = (end) => (end.card ? end : { ...end, x: Math.round(end.x + dx), y: Math.round(end.y + dy) })
  return { ...line, from: shift(line.from), to: shift(line.to) }
}
