import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import NoteEditor from './NoteEditor.jsx'
import LineEdit from './LineEdit.jsx'
import BoardIcon from './BoardIcon.jsx'
import { note } from '../../data/note.js'
import { newId } from '../../lib/note.js'

const NOTE_TAGS = ['p', 'h1', 'h2', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'strong', 'b', 'em', 'i', 's', 'u', 'a', 'br', 'hr']

function NoteText({ html }) {
  const safe = useMemo(() => {
    const purify = DOMPurify()
    purify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noreferrer')
      }
    })
    return purify.sanitize(html ?? '', { ALLOWED_TAGS: NOTE_TAGS, ALLOWED_ATTR: ['href', 'target', 'rel'] })
  }, [html])
  if (!safe) return <p className="text-white/30">{note.notePlaceholder}</p>
  return <div className="note-content" dangerouslySetInnerHTML={{ __html: safe }} />
}

// A to-do list being edited: a field per task. Enter adds the next one; Backspace on an empty one removes it.
function TodoEdit({ card, valueRef }) {
  const [title, setTitle] = useState(card.title ?? null)
  const [items, setItems] = useState(() => (card.items?.length ? card.items : [{ id: newId(), text: '', done: false }]))
  const [focus, setFocus] = useState(items[items.length - 1].id)
  const fields = useRef(new Map())

  useEffect(() => {
    valueRef.current = () => ({ title: title === null ? null : title.trim(), items: items.map((i) => ({ ...i, text: i.text.trim() })).filter((i) => i.text) })
    return () => { valueRef.current = null }
  }, [title, items, valueRef])
  useEffect(() => {
    fields.current.get(focus)?.focus()
  }, [focus])

  function onKeyDown(e, index) {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      const item = { id: newId(), text: '', done: false }
      setItems([...items.slice(0, index + 1), item, ...items.slice(index + 1)])
      setFocus(item.id)
    } else if (e.key === 'Backspace' && !items[index].text && items.length > 1) {
      e.preventDefault()
      setItems(items.filter((_, i) => i !== index))
      setFocus(items[Math.max(0, index - 1)].id)
    }
  }

  return (
    <div>
      {title !== null && <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={note.todoTitle} className="mb-2 w-full bg-transparent font-bold outline-none placeholder:text-white/30" />}
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-start gap-2.5">
            <input type="checkbox" checked={item.done} onChange={(e) => setItems(items.map((i) => (i.id === item.id ? { ...i, done: e.target.checked } : i)))} className="mt-1 h-4 w-4 shrink-0 accent-white" />
            <input
              ref={(el) => (el ? fields.current.set(item.id, el) : fields.current.delete(item.id))}
              value={item.text}
              onChange={(e) => setItems(items.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)))}
              onKeyDown={(e) => onKeyDown(e, index)}
              placeholder={note.todoPlaceholder}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/30"
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function TodoView({ card, canEdit, onToggle }) {
  return (
    <div>
      {card.title != null && <p className="mb-2 font-bold">{card.title || note.todoTitle}</p>}
      {!card.items?.length && <p className="text-white/30">{note.todoPlaceholder}</p>}
      <ul className="space-y-1.5">
        {card.items?.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={item.done}
              disabled={!canEdit}
              onChange={() => onToggle(item.id)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={item.text}
              className="mt-1 h-4 w-4 shrink-0 accent-white"
            />
            <span className={`min-w-0 flex-1 break-words ${item.done ? 'text-white/40' : ''}`}>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// The inside of a card, by type. `child` is the board a board card stands for; `kids` is how many
// cards a column holds (the board draws them under this header).
// While `editing`, the card's editor puts its current value in `valueRef` for the board to save.
export default function CardBody({ card, child, kids = 0, editing, canEdit, valueRef, onEditor, onEditorChange, onToggleTodo }) {
  if (card.type === 'column') {
    return (
      <div className="px-3 pb-1 pt-3 text-center">
        {editing
          ? <LineEdit value={card.title} field="title" valueRef={valueRef} placeholder={note.newColumn} className="text-center font-bold" />
          : <p className={`break-words font-bold ${card.title ? '' : 'text-white/50'}`}>{card.title || note.newColumn}</p>}
        <p className="text-xs text-white/50">{kids} card{kids === 1 ? '' : 's'}</p>
      </div>
    )
  }
  if (card.type === 'file') {
    const size = card.size >= 1048576 ? `${(card.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(card.size / 1024))} KB`
    return (
      <div>
        {card.thumb
          ? <img src={card.thumb} alt="" draggable="false" className="block w-full rounded-t-md bg-white" />
          : <div className="flex h-32 items-center justify-center rounded-t-md bg-neutral-800 text-2xl font-extrabold tracking-widest text-white/40">PDF</div>}
        <div className="flex items-center gap-3 p-3">
          <span className="shrink-0 rounded bg-red-500/90 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">PDF</span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{card.name}</span>
            <span className="block text-xs text-white/50">{[card.pages && `${card.pages} page${card.pages === 1 ? '' : 's'}`, size].filter(Boolean).join(' · ')}</span>
          </span>
        </div>
      </div>
    )
  }
  if (card.type === 'note') {
    return editing ? <NoteEditor html={card.html} valueRef={valueRef} onEditor={onEditor} onChange={onEditorChange} /> : <NoteText html={card.html} />
  }
  if (card.type === 'heading') {
    return editing
      ? <LineEdit value={card.text} field="text" valueRef={valueRef} placeholder={note.headingPlaceholder} className="text-2xl font-extrabold tracking-tight" />
      : <p className={`break-words text-2xl font-extrabold tracking-tight ${card.text ? '' : 'text-white/50'}`}>{card.text || note.headingPlaceholder}</p>
  }
  if (card.type === 'todo') {
    return editing ? <TodoEdit card={card} valueRef={valueRef} /> : <TodoView card={card} canEdit={canEdit} onToggle={onToggleTodo} />
  }
  // board
  const count = child?.cardCount ?? 0
  return (
    <div className="flex flex-col items-center gap-2 text-center" data-board-card={card.boardId}>
      <BoardIcon board={child} />
      {editing
        ? <LineEdit value={child?.title} field="boardTitle" valueRef={valueRef} placeholder={note.newBoard} className="text-center text-sm font-bold" />
        : <span className="max-w-full break-words text-sm font-bold">{child?.title || note.newBoard}</span>}
      <span className="-mt-1 text-xs text-white/70">{count} card{count === 1 ? '' : 's'}</span>
    </div>
  )
}
