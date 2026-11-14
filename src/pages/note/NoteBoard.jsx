import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import Notice from '../../components/ui/Notice.jsx'
import CardBody from '../../components/note/CardBody.jsx'
import NoteHeader from '../../components/note/NoteHeader.jsx'
import NoteToolbar from '../../components/note/NoteToolbar.jsx'
import TrashPanel from '../../components/note/TrashPanel.jsx'
import ShareDialog from '../../components/note/ShareDialog.jsx'
import { useAuth } from '../../components/auth/AuthProvider.jsx'
import { ensureOwnerMember, getMembership } from '../../lib/team.js'
import {
  HOME, ancestors, createBoard, ensureHome, isBoardId, moveCards, newId, patchCard, patchCards, removeCard,
  setCard, setPublic, updateBoard, watchBoard, watchCards, watchChildren,
} from '../../lib/note.js'
import { CARD_WIDTH, MAX_WIDTH, MIN_WIDTH, colorOf, note } from '../../data/note.js'

const BOARD_CARD_WIDTH = 128
const typing = (el) => el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '')
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

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
  const [trashOpen, setTrashOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const scroller = useRef(null)
  const valueRef = useRef(null) // set by the card being edited: () => fields to save
  const dragRef = useRef(null)
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

  const shown = cards.filter((c) => !c.trashed).sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  const trashed = cards.filter((c) => c.trashed)
  const selected = shown.filter((c) => selection.includes(c.id))

  // Keep the count shown under this board's icon (on its parent) up to date.
  const count = shown.length
  useEffect(() => {
    if (canEdit && board && board.cardCount !== count) updateBoard(boardId, { cardCount: count }).catch(() => {})
  }, [canEdit, board, boardId, count])

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

  // --- Card actions ---
  function addCard(type, x, y) {
    const base = {
      id: newId(), type, x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)),
      w: type === 'board' ? BOARD_CARD_WIDTH : CARD_WIDTH, z: Math.max(0, ...cards.map((c) => c.z ?? 0)) + 1,
      color: 'default', trashed: false, createdBy: email, createdAt: new Date().toISOString(),
    }
    const card = { note: { ...base, html: '' }, todo: { ...base, title: null, items: [] }, heading: { ...base, text: '' }, board: { ...base, boardId: newId() } }[type]
    let first = true
    commit({
      redo: () => {
        if (!first) return patchCard(boardId, card.id, { trashed: false })
        first = false
        return type === 'board' ? createBoard(board, card, note.newBoard, email) : setCard(boardId, card)
      },
      undo: () => patchCard(boardId, card.id, { trashed: true }),
    })
    setSelection([card.id])
    setEditing(card.id)
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

  function duplicate() {
    const copies = selected.filter((c) => c.type !== 'board').map((c, i) => ({ ...c, id: newId(), x: c.x + 18, y: c.y + 18, z: Math.max(0, ...cards.map((k) => k.z ?? 0)) + 1 + i, createdAt: new Date().toISOString() }))
    if (!copies.length) return
    let first = true
    commit({
      redo: () => {
        const again = !first
        first = false
        return again ? patchCards(boardId, copies.map((c) => ({ id: c.id, fields: { trashed: false } }))) : Promise.all(copies.map((c) => setCard(boardId, c)))
      },
      undo: () => patchCards(boardId, copies.map((c) => ({ id: c.id, fields: { trashed: true } }))),
    })
    setSelection(copies.map((c) => c.id))
  }

  function setColor(color) {
    selected.filter((c) => c.type === 'board').forEach((c) => run(updateBoard(c.boardId, { color })))
    patch(selected.filter((c) => c.type !== 'board' && c.color !== color).map((c) => ({ id: c.id, before: { color: c.color ?? 'default' }, after: { color } })))
  }

  function toggleTodo(card, itemId) {
    patch([{ id: card.id, before: { items: card.items }, after: { items: card.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) } }])
  }

  function nudge(dx, dy) {
    patch(selected.map((c) => ({ id: c.id, before: { x: c.x, y: c.y }, after: { x: Math.max(0, c.x + dx), y: Math.max(0, c.y + dy) } })))
  }

  const open = (id) => navigate(`/team/note/${id}`)

  // --- Pointer: moving, resizing, box-selecting, dragging a tool out ---
  const point = (e) => {
    const r = scroller.current.getBoundingClientRect()
    return { x: e.clientX - r.left + scroller.current.scrollLeft, y: e.clientY - r.top + scroller.current.scrollTop }
  }
  function startDrag(state) {
    dragRef.current = state
    setDrag(state)
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
    startDrag({ kind: 'move', ids: next, cardId: card.id, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, moved: false, wasAlone: !e.shiftKey && selection.length === 1 && selection[0] === card.id })
  }

  function onResizeDown(e, card) {
    e.stopPropagation()
    e.preventDefault()
    startDrag({ kind: 'resize', cardId: card.id, sx: e.clientX, startW: card.w ?? CARD_WIDTH, w: card.w ?? CARD_WIDTH })
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
      let next
      if (d.kind === 'move' || d.kind === 'tool') {
        const dx = e.clientX - d.sx
        const dy = e.clientY - d.sy
        next = { ...d, dx, dy, cx: e.clientX, cy: e.clientY, moved: d.moved || Math.abs(dx) + Math.abs(dy) > 4 }
      } else if (d.kind === 'resize') {
        next = { ...d, w: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, d.startW + e.clientX - d.sx)) }
      } else {
        next = { ...d, cx: e.clientX, cy: e.clientY }
        const box = { l: Math.min(d.sx, e.clientX), r: Math.max(d.sx, e.clientX), t: Math.min(d.sy, e.clientY), b: Math.max(d.sy, e.clientY) }
        const hit = [...scroller.current.querySelectorAll('[data-card-id]')].filter((el) => {
          const r = el.getBoundingClientRect()
          return r.left < box.r && r.right > box.l && r.top < box.b && r.bottom > box.t
        }).map((el) => el.dataset.cardId)
        setSelection([...new Set([...d.base, ...hit])])
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

  function drop(d, e) {
    if (d.kind === 'tool') {
      const r = scroller.current.getBoundingClientRect()
      const inside = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom
      if (!d.moved || !inside) return setHint(d.moved ? null : d.type)
      const p = point(e)
      return addCard(d.type, p.x - (d.type === 'board' ? BOARD_CARD_WIDTH : CARD_WIDTH) / 2, p.y - 24)
    }
    if (d.kind === 'resize') {
      const card = cards.find((c) => c.id === d.cardId)
      if (card && d.w !== (card.w ?? CARD_WIDTH)) patch([{ id: card.id, before: { w: card.w ?? CARD_WIDTH }, after: { w: Math.round(d.w) } }])
      return
    }
    if (d.kind !== 'move') return
    const card = cards.find((c) => c.id === d.cardId)
    if (!d.moved) {
      // A click on the one card that was already selected starts editing it.
      if (d.wasAlone && card && card.type !== 'board') setEditing(card.id)
      return
    }
    const moving = shown.filter((c) => d.ids.includes(c.id))
    // Dropped on a board's icon: the cards go inside that board.
    const target = document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest('[data-card-id]')).find((el) => el && !d.ids.includes(el.dataset.cardId))
    const onto = target && shown.find((c) => c.id === target.dataset.cardId && c.type === 'board')
    if (onto && children.get(onto.boardId)) {
      run(moveCards(boardId, children.get(onto.boardId), moving))
      setSelection([])
      setHistory({ undo: [], redo: [] })
      return
    }
    patch(moving.map((c) => ({ id: c.id, before: { x: c.x, y: c.y }, after: { x: Math.max(0, Math.round(c.x + d.dx)), y: Math.max(0, Math.round(c.y + d.dy)) } })))
  }

  // --- Keyboard ---
  api.current = { drop, undo, redo, finishEditing, trashSelected, duplicate, nudge, selected, editing, shown, open, setEditing, setSelection }
  useEffect(() => {
    if (!canEdit) return
    function onKey(e) {
      const a = api.current
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'Escape') {
        if (a.editing) a.finishEditing()
        else a.setSelection([])
        return
      }
      if (typing(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) a.redo(); else a.undo() }
      else if (mod && key === 'y') { e.preventDefault(); a.redo() }
      else if (mod && key === 'a') { e.preventDefault(); a.setSelection(a.shown.map((c) => c.id)) }
      else if (mod && key === 'd') { e.preventDefault(); a.duplicate() }
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

  const width = Math.max(0, ...shown.map((c) => c.x + (c.w ?? CARD_WIDTH))) + 600
  const height = Math.max(0, ...shown.map((c) => c.y)) + 900
  const box = drag?.kind === 'marquee' && scroller.current ? (() => {
    const r = scroller.current.getBoundingClientRect()
    return { left: Math.min(drag.sx, drag.cx) - r.left + scroller.current.scrollLeft, top: Math.min(drag.sy, drag.cy) - r.top + scroller.current.scrollTop, width: Math.abs(drag.cx - drag.sx), height: Math.abs(drag.cy - drag.sy) }
  })() : null

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <NoteHeader
        board={board} trail={trail} canEdit={canEdit} saving={pending > 0}
        canUndo={history.undo.length > 0} canRedo={history.redo.length > 0} onUndo={undo} onRedo={redo}
        onRename={(title) => run(updateBoard(boardId, { title }))} onShare={() => setShareOpen(true)}
      />
      {error && <p className="bg-red-950/80 px-4 py-2 text-sm text-red-200" role="alert">{error}</p>}
      <div className="flex min-h-0 flex-1">
        {canEdit && (
          <NoteToolbar
            selected={selected} editor={editing ? editor : null} onDragStart={onToolDown} hintFor={hint}
            onBack={() => { finishEditing(); setSelection([]) }} onColor={setColor} onTrash={trashSelected}
            onToggleTitle={() => patch([{ id: selected[0].id, before: { title: selected[0].title ?? null }, after: { title: selected[0].title == null ? '' : null } }])}
            onRename={() => setEditing(selected[0].id)} onOpenTrash={() => setTrashOpen(true)} trashCount={trashed.length}
          />
        )}
        <div
          ref={scroller}
          className="note-canvas relative min-w-0 flex-1 overflow-auto"
          onPointerDown={onCanvasPointerDown}
          onDoubleClick={(e) => { if (canEdit && !e.target.closest('[data-card-id]')) { const p = point(e); addCard('note', p.x - 20, p.y - 20) } }}
        >
          <div className="relative" style={{ width, height, minWidth: '100%', minHeight: '100%' }}>
            {shown.map((card) => {
              const isSelected = selection.includes(card.id)
              const isEditing = editing === card.id
              const moving = drag?.kind === 'move' && drag.moved && drag.ids.includes(card.id)
              const w = drag?.kind === 'resize' && drag.cardId === card.id ? drag.w : card.w ?? CARD_WIDTH
              const framed = card.type === 'note' || card.type === 'todo'
              return (
                <div
                  key={card.id}
                  data-card-id={card.id}
                  style={{ left: card.x + (moving ? drag.dx : 0), top: card.y + (moving ? drag.dy : 0), width: card.type === 'board' ? BOARD_CARD_WIDTH : w, zIndex: (card.z ?? 0) + (moving ? 100000 : 0) }}
                  className={[
                    'absolute text-sm',
                    framed ? `rounded-md border p-4 shadow-lg shadow-black/30 ${colorOf(card.color).card}` : 'rounded-md p-2',
                    isSelected ? 'outline outline-2 outline-white' : '',
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
                    card={card} child={children.get(card.boardId)} editing={isEditing} canEdit={canEdit} valueRef={valueRef}
                    onEditor={setEditor} onEditorChange={() => redraw((n) => n + 1)} onToggleTodo={(itemId) => toggleTodo(card, itemId)}
                  />
                  {canEdit && isSelected && framed && selection.length === 1 && (
                    <span onPointerDown={(e) => onResizeDown(e, card)} className="absolute bottom-0 right-0 h-4 w-4 cursor-ew-resize touch-none rounded-br-md border-b-2 border-r-2 border-white/70" aria-hidden="true" />
                  )}
                </div>
              )
            })}
            {box && <div className="pointer-events-none absolute z-[200000] border border-white/60 bg-white/10" style={box} />}
          </div>
        </div>
      </div>
      {drag?.kind === 'tool' && drag.moved && (
        <div className="pointer-events-none fixed z-[60] rounded-md border border-white/40 bg-neutral-800/90 px-3 py-2 text-xs font-semibold" style={{ left: drag.cx + 8, top: drag.cy + 8 }}>
          New {drag.type}
        </div>
      )}
      <TrashPanel
        open={trashOpen} onClose={() => setTrashOpen(false)} cards={trashed} children={children}
        onRestore={(id) => patch([{ id, before: { trashed: true }, after: { trashed: false } }])}
        onEmpty={() => { trashed.forEach((c) => run(removeCard(boardId, c.id))); setHistory({ undo: [], redo: [] }) }}
      />
      {canEdit && <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} board={board} onToggle={(on) => run(setPublic(boardId, on))} />}
    </div>
  )
}

// /team/note/:boardId ("home" is the top board). Works out whether the visitor is on the team
// (can edit) or not (read-only, shared boards only), then shows the board.
export default function NoteBoard() {
  const { boardId } = useParams()
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
  if (loading || team === undefined) return <p className="p-8 text-sm text-white/50">Loading…</p>
  return (
    <>
      <Board
        key={`${boardId}-${team}`} boardId={boardId} canEdit={team} email={user?.email} signedIn={Boolean(user)}
        onSignIn={async () => setSignInError(await signIn())} onSignOut={signOut}
      />
      {signInError && <p className="px-4 text-center text-sm text-red-300/90" role="alert">{signInError}</p>}
    </>
  )
}
