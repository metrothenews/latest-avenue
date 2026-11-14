import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import NoteEditor from './NoteEditor.jsx'
import { colorOf, note } from '../../data/note.js'
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

// One-line text field that saves through valueRef (used by headings and board names).
function LineEdit({ value, field, valueRef, placeholder, className }) {
  const [text, setText] = useState(value ?? '')
  const input = useRef(null)
  useEffect(() => {
    input.current.focus()
    input.current.select()
  }, [])
  useEffect(() => {
    valueRef.current = () => ({ [field]: text.trim() })
    return () => { valueRef.current = null }
  }, [text, field, valueRef])
  return <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className={`w-full bg-transparent outline-none placeholder:text-white/30 ${className}`} />
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

// The inside of a card, by type. `child` is the board a board card stands for.
// While `editing`, the card's editor puts its current value in `valueRef` for the board to save.
export default function CardBody({ card, child, editing, canEdit, valueRef, onEditor, onEditorChange, onToggleTodo }) {
  if (card.type === 'note') {
    return editing ? <NoteEditor html={card.html} valueRef={valueRef} onEditor={onEditor} onChange={onEditorChange} /> : <NoteText html={card.html} />
  }
  if (card.type === 'heading') {
    return editing
      ? <LineEdit value={card.text} field="text" valueRef={valueRef} placeholder={note.headingPlaceholder} className="text-2xl font-extrabold tracking-tight" />
      : <p className={`break-words text-2xl font-extrabold tracking-tight ${card.text ? '' : 'text-white/30'}`}>{card.text || note.headingPlaceholder}</p>
  }
  if (card.type === 'todo') {
    return editing ? <TodoEdit card={card} valueRef={valueRef} /> : <TodoView card={card} canEdit={canEdit} onToggle={onToggleTodo} />
  }
  // board
  const count = child?.cardCount ?? 0
  return (
    <div className="flex flex-col items-center gap-2 text-center" data-board-card={card.boardId}>
      <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${colorOf(child?.color).board}`} aria-hidden="true">
        <span className="grid grid-cols-2 gap-1">
          {[0, 1, 2, 3].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-sm bg-white/80" />)}
        </span>
      </span>
      {editing
        ? <LineEdit value={child?.title} field="boardTitle" valueRef={valueRef} placeholder={note.newBoard} className="text-center text-sm font-bold" />
        : <span className="max-w-full break-words text-sm font-bold">{child?.title || note.newBoard}</span>}
      <span className="-mt-1 text-xs text-white/40">{count} card{count === 1 ? '' : 's'}</span>
    </div>
  )
}
