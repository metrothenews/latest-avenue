import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import Notice from '../../components/ui/Notice.jsx'
import Modal from '../../components/ui/Modal.jsx'
import CardBody from '../../components/note/CardBody.jsx'
import NoteHeader from '../../components/note/NoteHeader.jsx'
import NoteToolbar from '../../components/note/NoteToolbar.jsx'
import TrashPanel from '../../components/note/TrashPanel.jsx'
import ShareDialog from '../../components/note/ShareDialog.jsx'
import Lines from '../../components/note/Lines.jsx'
import ContextMenu from '../../components/note/ContextMenu.jsx'
import { useAuth } from '../../components/auth/AuthProvider.jsx'
import { ensureOwnerMember, getMembership } from '../../lib/team.js'
import {
  HOME, ancestors, createBoard, ensureHome, isBoardId, moveCards, newId, patchCard, patchCards, removeCard,
  setCard, setPublic, updateBoard, watchBoard, watchCards, watchChildren,
} from '../../lib/note.js'
import { shiftLine } from '../../lib/noteGeometry.js'
import { CARD_WIDTH, COLUMN_WIDTH, MAX_WIDTH, MIN_WIDTH, ZOOM_MAX, ZOOM_MIN, colorOf, note } from '../../data/note.js'

const BOARD_CARD_WIDTH = 128
const typing = (el) => el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '')
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))
const widthOf = (card) => (card.type === 'board' ? BOARD_CARD_WIDTH : card.w ?? CARD_WIDTH)
// Copied cards, kept while the site stays open, so they can be pasted on another board.
let clipboard = []

// One board: header, toolbar and the canvas of cards. `canEdit` is true for team members;
// everyone else gets a read-only view (and only if the board is shared).
function Board({ boardId, canEdit, email, signedIn, onSignIn, onSignOut }) {
  const navigate = useNavigate()
  const [board, setBoard] = useState(undefined) // undefined while loading, null if missing or private
  const [cards, setCards] = useState([])
  const [children, setChildren] = useState(new Map())
  const [trail, setTrail] = useState([])
  const [selection, setSelection] = useState([])
  const [editing, setEditing] = useState(null)
  const [editor, setEditor] = useState(null) // the note editor while a note is being edited
  const [, redraw] = useState(0)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState('')
  const [history, setHistory] = useState({ undo: [], redo: [] })
  const [drag, setDrag] = useState(null)
  const [hint, setHint] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [rects, setRects] = useState(new Map()) // where each card is on the board, as drawn
  const [menu, setMenu] = useState(null) // right-click menu: { x, y, items }
  const [trashOpen, setTrashOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const scroller = useRef(null)
  const inner = useRef(null)
  const valueRef = useRef(null) // set by the card being edited: () => fields to save
  const dragRef = useRef(null)
  const lastPoint = useRef({ x: 80, y: 80 }) // where the pointer last was on the board, for paste
  const api = useRef({})

  // --- Loading ---
  useEffect(() => {
    let live = true
    let stop = () => {}
    const start = () => { if (live) stop = watchBoard(boardId, setBoard) }
    if (canEdit && boardId === HOME) ensureHome(email, note.homeTitle).catch(() => {}).then(start)
    else start()
    return () => { live = false; stop() }
  }, [boardId, canEdit, email])

  const readable = Boolean(board)
  useEffect(() => {
    if (!readable) return
    const stops = [watchCards(boardId, setCards, () => setError("Couldn't load this board's cards.")), watchChildren(boardId, canEdit, setChildren)]
    return () => stops.forEach((stop) => stop())
  }, [boardId, readable, canEdit])

  const parent = board?.parent
  useEffect(() => {
    if (!readable) return
    let live = true
    ancestors({ parent }).then((t) => live && setTrail(t))
    return () => { live = false }
  }, [readable, parent])

  // --- What's on the board ---
  const all = new Map(cards.map((c) => [c.id, c]))
  // A card in a trashed column is hidden with it; a card whose column is gone sits on the board.
  const shown = cards.filter((c) => !c.trashed && !(c.column && all.get(c.column)?.trashed))
  const inColumn = (c) => Boolean(c.column && all.get(c.column) && c.type !== 'line')
  const top = shown.filter((c) => c.type !== 'line' && !inColumn(c)).sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  const kidsOf = (columnId) => shown.filter((c) => c.column === columnId && c.type !== 'line').sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const lines = shown.filter((c) => c.type === 'line')
  const trashed = cards.filter((c) => c.trashed)
  const selected = shown.filter((c) => selection.includes(c.id))
  const topZ = () => Math.max(0, ...cards.map((c) => c.z ?? 0))

  // Keep the count shown under this board's icon (on its parent) up to date. Lines don't count.
  const count = shown.length - lines.length
  useEffect(() => {
    if (canEdit && board && board.cardCount !== count) updateBoard(boardId, { cardCount: count }).catch(() => {})
  }, [canEdit, board, boardId, count])

  // Measure where every card is drawn, so lines can attach to them.
  useLayoutEffect(() => {
    if (!inner.current) return
    const base = inner.current.getBoundingClientRect()
    const next = new Map()
    inner.current.querySelectorAll('[data-card-id]:not([data-line])').forEach((el) => {
      const r = el.getBoundingClientRect()
      next.set(el.dataset.cardId, { x: Math.round((r.left - base.left) / zoom), y: Math.round((r.top - base.top) / zoom), w: Math.round(r.width / zoom), h: Math.round(r.height / zoom) })
    })
    if (!same([...next], [...rects])) setRects(next)
  })

  // --- Saving, undo and redo ---
  function run(promise) {
    setPending((p) => p + 1)
    setError('')
    return Promise.resolve(promise)
      .catch((err) => setError(`Couldn't save: ${err.message}`))
      .finally(() => setPending((p) => p - 1))
  }
  // op = { redo, undo }: functions that write the change and its reverse.
  function commit(op) {
    run(op.redo())
    setHistory((h) => ({ undo: [...h.undo, op].slice(-100), redo: [] }))
  }
  function undo() {
    const op = history.undo.at(-1)
    if (!op) return
    run(op.undo())
    setHistory((h) => ({ undo: h.undo.slice(0, -1), redo: [...h.redo, op] }))
  }
  function redo() {
    const op = history.redo.at(-1)
    if (!op) return
    run(op.redo())
    setHistory((h) => ({ undo: [...h.undo, op], redo: h.redo.slice(0, -1) }))
  }
  // patches = [{ id, before, after }] (field objects).
  function patch(patches) {
    if (!patches.length) return
    commit({
      redo: () => patchCards(boardId, patches.map((p) => ({ id: p.id, fields: p.after }))),
      undo: () => patchCards(boardId, patches.map((p) => ({ id: p.id, fields: p.before }))),
    })
  }
  // Adds brand-new cards (undo trashes them, redo brings them back).
  function addCards(list, create = () => Promise.all(list.map((c) => setCard(boardId, c)))) {
    let first = true
    commit({
      redo: () => {
        const again = !first
        first = false
        return again ? patchCards(boardId, list.map((c) => ({ id: c.id, fields: { trashed: false } }))) : create()
      },
      undo: () => patchCards(boardId, list.map((c) => ({ id: c.id, fields: { trashed: true } }))),
    })
    setSelection(list.map((c) => c.id))
  }

  // --- Card actions ---
  function addCard(type, x, y) {
    const base = {
      id: newId(), type, x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)),
      w: { board: BOARD_CARD_WIDTH, column: COLUMN_WIDTH }[type] ?? CARD_WIDTH, z: topZ() + 1,
      color: 'default', trashed: false, createdBy: email, createdAt: new Date().toISOString(),
    }
    const cx = base.x + base.w / 2
    const card = {
      note: { ...base, html: '' },
      todo: { ...base, title: null, items: [] },
      heading: { ...base, text: '' },
      board: { ...base, boardId: newId() },
      column: { ...base, title: '', collapsed: false },
      line: { ...base, from: { card: null, x: Math.round(cx - 80), y: base.y + 100 }, to: { card: null, x: Math.round(cx + 80), y: base.y }, startArrow: false, endArrow: true, dashed: false, weight: 2, label: '', bend: null },
    }[type]
    addCards([card], type === 'board' ? () => createBoard(board, card, note.newBoard, email) : undefined)
    if (type !== 'line') setEditing(card.id)
  }

  // Leaves edit mode, saving what changed.
  function finishEditing() {
    if (!editing) return
    const card = cards.find((c) => c.id === editing)
    const fields = valueRef.current?.()
    setEditing(null)
    setEditor(null)
    if (!card || !fields) return
    if ('boardTitle' in fields) {
      const title = fields.boardTitle || note.newBoard
      if (title !== children.get(card.boardId)?.title) run(updateBoard(card.boardId, { title }))
      return
    }
    const before = Object.fromEntries(Object.keys(fields).map((k) => [k, card[k] ?? null]))
    if (!same(before, fields)) patch([{ id: card.id, before, after: fields }])
  }

  function trashSelected() {
    patch(selected.map((c) => ({ id: c.id, before: { trashed: false }, after: { trashed: true } })))
    setSelection([])
  }

  // Copies of cards for duplicate and paste. Boards and columns aren't copied (they hold other things).
  const copyable = (list) => list.filter((c) => c.type !== 'board' && c.type !== 'column')
  function copies(list, dx, dy) {
    const z = topZ()
    return list.map((c, i) => {
      const { column, order, ...rest } = c
      const at = inColumn(c) && rects.get(c.id) ? rects.get(c.id) : c
      const copy = { ...rest, id: newId(), x: Math.max(0, Math.round((at.x ?? 0) + dx)), y: Math.max(0, Math.round((at.y ?? 0) + dy)), z: z + 1 + i, trashed: false, createdBy: email, createdAt: new Date().toISOString() }
      // A copied line stands alone: its ends stay where they were drawn, shifted with it.
      return c.type === 'line' ? shiftLine({ ...copy, from: { ...lineEnd(c.from), card: null }, to: { ...lineEnd(c.to), card: null } }, dx, dy) : copy
    })
  }
  const lineEnd = (end) => (end.card && rects.get(end.card) ? { card: null, x: rects.get(end.card).x + rects.get(end.card).w / 2, y: rects.get(end.card).y + rects.get(end.card).h / 2 } : end)

  function duplicate() {
    const list = copies(copyable(selected), 18, 18)
    if (list.length) addCards(list)
  }
  function copy() {
    clipboard = copyable(selected).map((c) => (inColumn(c) && rects.get(c.id) ? { ...c, x: rects.get(c.id).x, y: rects.get(c.id).y } : c.type === 'line' ? { ...c, from: lineEnd(c.from), to: lineEnd(c.to) } : c))
  }
  function paste() {
    if (!clipboard.length) return
    // Keep the copied cards' layout, with its top-left corner at the pointer.
    const xs = clipboard.flatMap((c) => (c.type === 'line' ? [c.from.x, c.to.x] : [c.x]))
    const ys = clipboard.flatMap((c) => (c.type === 'line' ? [c.from.y, c.to.y] : [c.y]))
    const dx = lastPoint.current.x - Math.min(...xs)
    const dy = lastPoint.current.y - Math.min(...ys)
    addCards(clipboard.map((c) => ({ ...c, column: undefined, order: undefined })).map((c) => {
      const { column, order, ...rest } = c
      const moved = { ...rest, id: newId(), z: topZ() + 1, trashed: false, createdBy: email, createdAt: new Date().toISOString(), x: Math.max(0, Math.round((c.x ?? 0) + dx)), y: Math.max(0, Math.round((c.y ?? 0) + dy)) }
      return c.type === 'line' ? shiftLine({ ...moved, from: { ...c.from, card: null }, to: { ...c.to, card: null } }, dx, dy) : moved
    }))
  }

  function setColor(color) {
    selected.filter((c) => c.type === 'board').forEach((c) => run(updateBoard(c.boardId, { color })))
    patch(selected.filter((c) => c.type !== 'board' && c.color !== color).map((c) => ({ id: c.id, before: { color: c.color ?? 'default' }, after: { color } })))
  }
  const setField = (card, field, value) => patch([{ id: card.id, before: { [field]: card[field] ?? null }, after: { [field]: value } }])
  const toggleTodo = (card, itemId) => setField(card, 'items', card.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)))
  const restack = (toFront) => patch(selected.map((c, i) => ({ id: c.id, before: { z: c.z ?? 0 }, after: { z: toFront ? topZ() + 1 + i : Math.min(0, ...cards.map((k) => k.z ?? 0)) - 1 - i } })))

  function nudge(dx, dy) {
    patch(selected.filter((c) => !inColumn(c)).map((c) => (c.type === 'line'
      ? { id: c.id, before: { from: c.from, to: c.to }, after: (({ from, to }) => ({ from, to }))(shiftLine(c, dx, dy)) }
      : { id: c.id, before: { x: c.x, y: c.y }, after: { x: Math.max(0, c.x + dx), y: Math.max(0, c.y + dy) } })))
  }

  const open = (id) => navigate(`/team/note/${id}`)

  // --- Zoom ---
  function zoomTo(next) {
    setZoom(clampZoom(next))
  }
  function fit() {
    const boxes = [...rects.values()]
    if (!boxes.length || !scroller.current) return setZoom(1)
    const right = Math.max(...boxes.map((r) => r.x + r.w)) + 40
    const bottom = Math.max(...boxes.map((r) => r.y + r.h)) + 40
    setZoom(clampZoom(Math.min(1, scroller.current.clientWidth / right, scroller.current.clientHeight / bottom)))
    scroller.current.scrollTo(0, 0)
  }
  // Ctrl or ⌘ with the mouse wheel zooms (a trackpad pinch arrives the same way).
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((z) => clampZoom(z * Math.exp(-e.deltaY * 0.0025)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [readable])

  // --- Pointer: moving, resizing, box-selecting, dragging a tool out, shaping lines ---
  const point = (e) => {
    const r = inner.current.getBoundingClientRect()
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }
  }
  function startDrag(state) {
    dragRef.current = state
    setDrag(state)
  }
  // The card under the pointer, ignoring the ones in `skip` (and anything inside them) and lines.
  function cardAt(e, skip) {
    const skipped = (el) => skip.some((id) => el.closest(`[data-card-id="${id}"]`))
    const el = document.elementsFromPoint(e.clientX, e.clientY).map((x) => x.closest('[data-card-id]:not([data-line])')).find((x) => x && !skipped(x))
    return el ? shown.find((c) => c.id === el.dataset.cardId) : null
  }

  function onCardPointerDown(e, card) {
    if (e.button !== 0 || editing === card.id) return
    e.stopPropagation()
    setHint(null)
    if (editing) finishEditing()
    if (!canEdit) return
    const next = e.shiftKey
      ? (selection.includes(card.id) ? selection.filter((id) => id !== card.id) : [...selection, card.id])
      : (selection.includes(card.id) ? selection : [card.id])
    setSelection(next)
    if (!next.includes(card.id)) return
    startDrag({ kind: 'move', ids: next, cardId: card.id, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, moved: false, over: null, wasAlone: !e.shiftKey && selection.length === 1 && selection[0] === card.id })
  }

  function onResizeDown(e, card) {
    e.stopPropagation()
    e.preventDefault()
    startDrag({ kind: 'resize', cardId: card.id, sx: e.clientX, startW: card.w ?? CARD_WIDTH, w: card.w ?? CARD_WIDTH })
  }

  function onEndDown(e, line, which) {
    e.stopPropagation()
    e.preventDefault()
    const p = point(e)
    startDrag({ kind: 'end', lineId: line.id, which, x: p.x, y: p.y, over: null })
  }

  function onBendDown(e, line, shape) {
    e.stopPropagation()
    e.preventDefault()
    startDrag({ kind: 'bend', lineId: line.id, mx: shape.straightMid.x, my: shape.straightMid.y, bx: line.bend?.x ?? 0, by: line.bend?.y ?? 0 })
  }

  function onCanvasPointerDown(e) {
    if (e.button !== 0 || e.target.closest('[data-card-id]')) return
    setHint(null)
    finishEditing()
    if (!canEdit) return
    if (!e.shiftKey) setSelection([])
    if (e.pointerType !== 'touch') startDrag({ kind: 'marquee', sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, base: e.shiftKey ? selection : [] })
  }

  function onToolDown(type, e) {
    if (e.button !== 0) return
    e.preventDefault()
    setHint(null)
    finishEditing()
    startDrag({ kind: 'tool', type, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, moved: false })
  }

  const dragging = Boolean(drag)
  useEffect(() => {
    if (!dragging) return
    function move(e) {
      const d = dragRef.current
      if (!d) return
      const a = api.current
      let next
      if (d.kind === 'move') {
        const dx = (e.clientX - d.sx) / a.zoom
        const dy = (e.clientY - d.sy) / a.zoom
        const moved = d.moved || Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4
        next = { ...d, dx, dy, moved, over: moved ? a.dropTarget(e, d.ids)?.id ?? null : null }
      } else if (d.kind === 'tool') {
        next = { ...d, cx: e.clientX, cy: e.clientY, moved: d.moved || Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4 }
      } else if (d.kind === 'resize') {
        next = { ...d, w: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, d.startW + (e.clientX - d.sx) / a.zoom)) }
      } else if (d.kind === 'end') {
        const p = a.point(e)
        next = { ...d, x: p.x, y: p.y, over: a.cardAt(e, [])?.id ?? null }
      } else if (d.kind === 'bend') {
        const p = a.point(e)
        next = { ...d, bx: p.x - d.mx, by: p.y - d.my }
      } else {
        next = { ...d, cx: e.clientX, cy: e.clientY }
        const box = { l: Math.min(d.sx, e.clientX), r: Math.max(d.sx, e.clientX), t: Math.min(d.sy, e.clientY), b: Math.max(d.sy, e.clientY) }
        const hit = [...scroller.current.querySelectorAll('[data-card-id]')].filter((el) => {
          const r = el.getBoundingClientRect()
          return r.left < box.r && r.right > box.l && r.top < box.b && r.bottom > box.t
        }).map((el) => el.dataset.cardId)
        a.setSelection([...new Set([...d.base, ...hit])])
      }
      dragRef.current = next
      setDrag(next)
    }
    function up(e) {
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (d) api.current.drop(d, e)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragging])

  // Where cards being dragged would land: a board icon (they go inside it) or a column.
  function dropTarget(e, ids) {
    const moving = shown.filter((c) => ids.includes(c.id))
    const under = cardAt(e, ids)
    if (!under) return null
    if (under.type === 'board') return children.get(under.boardId) ? under : null
    const column = under.type === 'column' ? under : inColumn(under) ? all.get(under.column) : null
    // Columns don't nest, and lines live on the board itself.
    return column && !column.collapsed && moving.some((c) => c.type !== 'column' && c.type !== 'line') && !moving.some((c) => c.type === 'column') ? column : null
  }

  function drop(d, e) {
    if (d.kind === 'tool') {
      const r = scroller.current.getBoundingClientRect()
      const inside = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom
      if (!d.moved || !inside) return setHint(d.moved ? null : d.type)
      const p = point(e)
      return addCard(d.type, p.x - ({ board: BOARD_CARD_WIDTH, column: COLUMN_WIDTH }[d.type] ?? CARD_WIDTH) / 2, p.y - 24)
    }
    if (d.kind === 'resize') {
      const card = cards.find((c) => c.id === d.cardId)
      if (card && d.w !== (card.w ?? CARD_WIDTH)) setField(card, 'w', Math.round(d.w))
      return
    }
    if (d.kind === 'end') {
      const line = all.get(d.lineId)
      const end = d.over ? { card: d.over, x: Math.round(d.x), y: Math.round(d.y) } : { card: null, x: Math.round(d.x), y: Math.round(d.y) }
      if (line) setField(line, d.which, end)
      return
    }
    if (d.kind === 'bend') {
      const line = all.get(d.lineId)
      // Pulled back almost straight: make it straight.
      if (line) setField(line, 'bend', Math.hypot(d.bx, d.by) < 8 ? null : { x: Math.round(d.bx), y: Math.round(d.by) })
      return
    }
    if (d.kind !== 'move') return
    const card = all.get(d.cardId)
    if (!d.moved) {
      // A click on the one card that was already selected starts editing it.
      if (d.wasAlone && card && card.type !== 'board') setEditing(card.id)
      return
    }
    const moving = shown.filter((c) => d.ids.includes(c.id))
    const target = dropTarget(e, d.ids)

    if (target?.type === 'board') {
      // Into another board: columns take their cards along; lines stay behind.
      const going = moving.filter((c) => c.type !== 'line')
      const withKids = [...going, ...going.filter((c) => c.type === 'column').flatMap((c) => kidsOf(c.id))]
      run(moveCards(boardId, children.get(target.boardId), withKids.map((c) => (c.column && !going.some((g) => g.id === c.column) ? { ...c, column: null } : c))))
      setSelection([])
      setHistory({ undo: [], redo: [] })
      return
    }

    if (target?.type === 'column') {
      // Into a column, at the place in the stack where they were dropped.
      const going = moving.filter((c) => c.type !== 'line' && c.type !== 'column')
      const stay = kidsOf(target.id).filter((k) => !d.ids.includes(k.id))
      const index = stay.filter((k) => {
        const r = scroller.current.querySelector(`[data-card-id="${k.id}"]`)?.getBoundingClientRect()
        return r && r.top + r.height / 2 < e.clientY
      }).length
      const prev = stay[index - 1]?.order
      const next = stay[index]?.order
      const step = prev != null && next != null ? (next - prev) / (going.length + 1) : 1
      const first = prev != null ? prev + step : next != null ? next - step * going.length : 0
      patch(going.map((c, i) => ({ id: c.id, before: { column: c.column ?? null, order: c.order ?? null }, after: { column: target.id, order: first + step * i } })))
      return
    }

    // Onto the board itself.
    const base = inner.current.getBoundingClientRect()
    patch(moving.map((c) => {
      if (c.type === 'line') return { id: c.id, before: { from: c.from, to: c.to }, after: (({ from, to }) => ({ from, to }))(shiftLine(c, d.dx, d.dy)) }
      if (inColumn(c)) {
        // Pulled out of its column (unless the column moved with it): it lands where it was let go.
        if (d.ids.includes(c.column)) return null
        const r = scroller.current.querySelector(`[data-card-id="${c.id}"]`).getBoundingClientRect()
        return { id: c.id, before: { column: c.column, order: c.order ?? null, x: c.x ?? 0, y: c.y ?? 0, z: c.z ?? 0 }, after: { column: null, order: null, x: Math.max(0, Math.round((r.left - base.left) / zoom)), y: Math.max(0, Math.round((r.top - base.top) / zoom)), z: topZ() + 1 } }
      }
      return { id: c.id, before: { x: c.x, y: c.y }, after: { x: Math.max(0, Math.round(c.x + d.dx)), y: Math.max(0, Math.round(c.y + d.dy)) } }
    }).filter(Boolean))
  }

  // --- Right-click menus ---
  function onContextMenu(e) {
    if (!canEdit) return
    e.preventDefault()
    finishEditing()
    const el = e.target.closest('[data-card-id]')
    const card = el && shown.find((c) => c.id === el.dataset.cardId)
    const p = point(e)
    lastPoint.current = p
    let items
    if (card) {
      const sel = selection.includes(card.id) ? selected : [card]
      if (!selection.includes(card.id)) setSelection([card.id])
      const one = sel.length === 1 ? card : null
      // Actions read the selection through api, which is up to date by the time one is chosen.
      const act = (name) => () => api.current[name]()
      items = [
        one?.type === 'board' && { label: 'Open', hint: '↵', onSelect: () => open(card.boardId) },
        one?.type === 'board' && { label: 'Open in new tab', onSelect: () => window.open(`/team/note/${card.boardId}`, '_blank', 'noopener') },
        one?.type === 'board' && { label: 'Copy link to this board', onSelect: () => navigator.clipboard?.writeText(`${window.location.origin}/team/note/${card.boardId}`) },
        one?.type === 'board' && { label: 'Rename', onSelect: () => setEditing(card.id) },
        one?.type === 'board' && null,
        { label: 'Cut', hint: '⌘X', disabled: !copyable(sel).length, onSelect: () => { api.current.copy(); api.current.trashSelected() } },
        { label: 'Copy', hint: '⌘C', disabled: !copyable(sel).length, onSelect: act('copy') },
        { label: 'Duplicate', hint: '⌘D', disabled: !copyable(sel).length, onSelect: act('duplicate') },
        null,
        { label: 'Bring to front', onSelect: () => api.current.restack(true) },
        { label: 'Send to back', onSelect: () => api.current.restack(false) },
        null,
        { label: 'Move to trash', hint: 'Del', onSelect: act('trashSelected') },
      ].filter((item) => item !== false && item !== undefined)
    } else {
      setSelection([])
      const add = (type) => () => addCard(type, p.x, p.y)
      items = [
        { label: 'Undo', hint: '⌘Z', disabled: !history.undo.length, onSelect: undo },
        { label: 'Redo', hint: '⇧⌘Z', disabled: !history.redo.length, onSelect: redo },
        null,
        { label: 'Paste', hint: '⌘V', disabled: !clipboard.length, onSelect: paste },
        { label: 'Select all', hint: '⌘A', onSelect: () => setSelection(shown.map((c) => c.id)) },
        null,
        { label: 'New note', onSelect: add('note') },
        { label: 'New to-do list', onSelect: add('todo') },
        { label: 'New heading', onSelect: add('heading') },
        { label: 'New line', onSelect: add('line') },
        { label: 'New board', onSelect: add('board') },
        { label: 'New column', onSelect: add('column') },
      ]
    }
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  // --- Keyboard ---
  api.current = { drop, dropTarget, cardAt, point, undo, redo, finishEditing, trashSelected, duplicate, copy, paste, restack, nudge, fit, zoomTo, zoom, selected, editing, shown, open, setEditing, setSelection }
  useEffect(() => {
    function onKey(e) {
      const a = api.current
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      // Zoom works for viewers too.
      if (mod && (key === '=' || key === '+')) { e.preventDefault(); return a.zoomTo(a.zoom + 0.1) }
      if (mod && key === '-') { e.preventDefault(); return a.zoomTo(a.zoom - 0.1) }
      if (mod && key === '0') { e.preventDefault(); return a.zoomTo(1) }
      if (!mod && key === 'z' && !typing(e.target)) return a.fit()
      if (!canEdit) return
      if (e.key === 'Escape') {
        if (a.editing) a.finishEditing()
        else a.setSelection([])
        return
      }
      if (typing(e.target)) return
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) a.redo(); else a.undo() }
      else if (mod && key === 'y') { e.preventDefault(); a.redo() }
      else if (mod && key === 'a') { e.preventDefault(); a.setSelection(a.shown.map((c) => c.id)) }
      else if (mod && key === 'd') { e.preventDefault(); a.duplicate() }
      else if (mod && key === 'c') { a.copy() }
      else if (mod && key === 'x') { a.copy(); a.trashSelected() }
      else if (mod && key === 'v') { a.paste() }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && a.selected.length) { e.preventDefault(); a.trashSelected() }
      else if (arrows[e.key] && a.selected.length) { e.preventDefault(); const step = e.shiftKey ? 1 : 10; a.nudge(arrows[e.key][0] * step, arrows[e.key][1] * step) }
      else if (e.key === 'Enter' && a.selected.length === 1) {
        e.preventDefault()
        if (a.selected[0].type === 'board') a.open(a.selected[0].boardId)
        else a.setEditing(a.selected[0].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit])

  // --- Rendering ---
  if (board === undefined) return <p className="p-8 text-sm text-white/50">Loading…</p>
  if (board === null) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <div className="glass space-y-4 p-8">
          <h1 className="text-2xl font-bold">{signedIn ? note.name : note.signInTitle}</h1>
          <p className="text-white/70">{signedIn ? (canEdit ? note.missing : note.notOnTeam) : note.signInText}</p>
          {signedIn ? <Button variant="secondary" onClick={onSignOut}>Sign out</Button> : <Button onClick={onSignIn}>{note.signIn}</Button>}
        </div>
      </div>
    )
  }

  const width = Math.max(0, ...top.map((c) => c.x + widthOf(c)), ...lines.flatMap((l) => [l.from.x ?? 0, l.to.x ?? 0])) + 600
  const height = Math.max(0, ...[...rects.values()].map((r) => r.y + r.h), ...lines.flatMap((l) => [l.from.y ?? 0, l.to.y ?? 0])) + 700
  const box = drag?.kind === 'marquee' && inner.current ? (() => {
    const r = inner.current.getBoundingClientRect()
    return { left: (Math.min(drag.sx, drag.cx) - r.left) / zoom, top: (Math.min(drag.sy, drag.cy) - r.top) / zoom, width: Math.abs(drag.cx - drag.sx) / zoom, height: Math.abs(drag.cy - drag.sy) / zoom }
  })() : null
  const dropOn = drag?.kind === 'move' ? drag.over : drag?.kind === 'end' ? drag.over : null

  function renderCard(card, stacked) {
    const isSelected = selection.includes(card.id)
    const isEditing = editing === card.id
    const moving = drag?.kind === 'move' && drag.moved && drag.ids.includes(card.id)
    const framed = card.type === 'note' || card.type === 'todo'
    const kids = card.type === 'column' ? kidsOf(card.id) : []
    const w = drag?.kind === 'resize' && drag.cardId === card.id ? drag.w : widthOf(card)
    const style = stacked
      ? { position: 'relative', transform: moving ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined, zIndex: moving ? 100000 : undefined }
      : { left: card.x + (moving ? drag.dx : 0), top: card.y + (moving ? drag.dy : 0), width: w, zIndex: (card.z ?? 0) + (moving ? 100000 : 0) }
    return (
      <div
        key={card.id}
        data-card-id={card.id}
        style={style}
        className={[
          stacked ? '' : 'absolute', 'text-sm',
          framed ? `rounded-md border p-4 ${stacked ? '' : 'shadow-lg shadow-black/30'} ${colorOf(card.color).card}` : '',
          card.type === 'column' ? `rounded-lg border shadow-lg shadow-black/30 ${colorOf(card.color).card}` : '',
          card.type === 'heading' || card.type === 'board' ? 'rounded-md p-2' : '',
          stacked && card.type === 'board' ? 'mx-auto w-32' : '',
          isSelected ? 'outline outline-2 outline-white' : dropOn === card.id ? 'outline outline-2 outline-dashed outline-white/70' : '',
          moving && stacked ? 'pointer-events-none' : '',
          canEdit ? (isEditing ? 'cursor-text' : 'cursor-grab touch-none select-none') : (card.type === 'board' ? 'cursor-pointer' : ''),
        ].join(' ')}
        onPointerDown={(e) => onCardPointerDown(e, card)}
        onClick={() => { if (!canEdit && card.type === 'board') open(card.boardId) }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          if (card.type === 'board') open(card.boardId)
          else if (canEdit && !isEditing) setEditing(card.id)
        }}
      >
        <CardBody
          card={card} child={children.get(card.boardId)} kids={kids.length} editing={isEditing} canEdit={canEdit} valueRef={valueRef}
          onEditor={setEditor} onEditorChange={() => redraw((n) => n + 1)} onToggleTodo={(itemId) => toggleTodo(card, itemId)}
        />
        {card.type === 'column' && (
          <>
            <button
              type="button" aria-label={card.collapsed ? 'Expand column' : 'Collapse column'} aria-expanded={!card.collapsed}
              onPointerDown={(e) => e.stopPropagation()} onClick={() => (canEdit ? setField(card, 'collapsed', !card.collapsed) : null)}
              className={`absolute right-1.5 top-1.5 h-6 w-6 rounded text-white/50 hover:bg-white/10 hover:text-white ${canEdit ? '' : 'hidden'}`}
            >{card.collapsed ? '+' : '–'}</button>
            {!card.collapsed && (
              <div className={`flex min-h-[3.5rem] flex-col gap-2 p-2 ${kids.length ? '' : 'm-2 rounded-md border border-dashed border-white/20'}`}>
                {kids.map((kid) => renderCard(kid, true))}
              </div>
            )}
          </>
        )}
        {canEdit && isSelected && !stacked && (framed || card.type === 'column') && selection.length === 1 && (
          <span onPointerDown={(e) => onResizeDown(e, card)} className="absolute bottom-0 right-0 h-4 w-4 cursor-ew-resize touch-none rounded-br-md border-b-2 border-r-2 border-white/70" aria-hidden="true" />
        )}
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <NoteHeader
        board={board} trail={trail} canEdit={canEdit} saving={pending > 0}
        canUndo={history.undo.length > 0} canRedo={history.redo.length > 0} onUndo={undo} onRedo={redo}
        onRename={(title) => run(updateBoard(boardId, { title }))} onShare={() => setShareOpen(true)}
        zoom={zoom} onZoom={zoomTo} onFit={fit}
      />
      {error && <p className="bg-red-950/80 px-4 py-2 text-sm text-red-200" role="alert">{error}</p>}
      <div className="flex min-h-0 flex-1">
        {canEdit && (
          <NoteToolbar
            selected={selected} editor={editing ? editor : null} onDragStart={onToolDown} hintFor={hint}
            onBack={() => { finishEditing(); setSelection([]) }} onColor={setColor} onTrash={trashSelected}
            onToggleTitle={() => setField(selected[0], 'title', selected[0].title == null ? '' : null)}
            onRename={() => setEditing(selected[0].id)} onLine={(field, value) => setField(selected[0], field, value)}
            onOpenTrash={() => setTrashOpen(true)} trashCount={trashed.length}
          />
        )}
        <div
          ref={scroller}
          className="note-canvas relative min-w-0 flex-1 overflow-auto"
          style={{ backgroundSize: `${22 * zoom}px ${22 * zoom}px` }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={(e) => { if (inner.current) lastPoint.current = point(e) }}
          onContextMenu={onContextMenu}
          onDoubleClick={(e) => { if (canEdit && !e.target.closest('[data-card-id]')) { const p = point(e); addCard('note', p.x - 20, p.y - 20) } }}
        >
          <div style={{ width: width * zoom, height: height * zoom, minWidth: '100%', minHeight: '100%' }}>
            <div ref={inner} className="relative origin-top-left" style={{ width, height, transform: zoom === 1 ? undefined : `scale(${zoom})` }}>
              {top.map((card) => renderCard(card, false))}
              <Lines
                lines={lines} rects={rects} width={width} height={height} selection={selection} drag={drag} editing={editing} valueRef={valueRef} canEdit={canEdit}
                onLineDown={onCardPointerDown} onEndDown={onEndDown} onBendDown={onBendDown} onLabelEdit={(line) => { setSelection([line.id]); setEditing(line.id) }}
              />
              {box && <div className="pointer-events-none absolute z-[200000] border border-white/60 bg-white/10" style={box} />}
            </div>
          </div>
        </div>
      </div>
      {drag?.kind === 'tool' && drag.moved && (
        <div className="pointer-events-none fixed z-[60] rounded-md border border-white/40 bg-neutral-800/90 px-3 py-2 text-xs font-semibold" style={{ left: drag.cx + 8, top: drag.cy + 8 }}>
          New {drag.type}
        </div>
      )}
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
      <TrashPanel
        open={trashOpen} onClose={() => setTrashOpen(false)} cards={trashed} children={children}
        onRestore={(id) => patch([{ id, before: { trashed: true }, after: { trashed: false } }])}
        onEmpty={() => {
          // A deleted column takes the cards inside it along for good.
          const gone = [...trashed, ...cards.filter((c) => c.column && all.get(c.column)?.trashed && !c.trashed)]
          gone.forEach((c) => run(removeCard(boardId, c.id)))
          setHistory({ undo: [], redo: [] })
        }}
      />
      {canEdit && <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} board={board} onToggle={(on) => run(setPublic(boardId, on))} />}
    </div>
  )
}

// /team/note/:boardId ("home" is the top board). Works out whether the visitor is on the team
// (can edit) or not (read-only, shared boards only), then shows the board.
// /team/note itself is the home board with a welcome pop-up over it.
export default function NoteBoard() {
  const params = useParams()
  const navigate = useNavigate()
  const boardId = params.boardId ?? HOME
  const welcome = !params.boardId
  const enter = () => navigate('/team/note/home', { replace: true })
  const { configured, user, loading, isOwner, signIn, signOut } = useAuth()
  const [team, setTeam] = useState(undefined) // undefined while checking
  const [signInError, setSignInError] = useState('')

  useEffect(() => {
    if (loading) return
    if (!user) return setTeam(false)
    let live = true
    setTeam(undefined)
    const lookup = isOwner ? ensureOwnerMember(user) : getMembership(user.email)
    lookup.then((m) => live && setTeam(Boolean(m)), () => live && setTeam(false))
    return () => { live = false }
  }, [user, isOwner, loading])

  if (!configured) return <Notice>Firebase isn't configured yet. Fill in src/data/firebase.js (see README → Owner login).</Notice>
  if (!isBoardId(boardId)) return <p className="p-8 text-white/70">{note.missing}</p>
  return (
    <>
      {loading || team === undefined ? <p className="p-8 text-sm text-white/50">Loading…</p> : <Board
        key={`${boardId}-${team}`} boardId={boardId} canEdit={team} email={user?.email} signedIn={Boolean(user)}
        onSignIn={async () => setSignInError(await signIn())} onSignOut={signOut}
      />}
      {signInError && <p className="px-4 text-center text-sm text-red-300/90" role="alert">{signInError}</p>}
      <Modal open={welcome} onClose={enter} title={note.name}>
        <p className="text-white/70">{note.tagline}</p>
        <Button className="mt-6" onClick={enter}>{note.open}</Button>
      </Modal>
    </>
  )
}
