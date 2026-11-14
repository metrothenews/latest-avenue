import { useState } from 'react'
import { colors, note, tools } from '../../data/note.js'

// Simple line icons for the tool tiles and buttons.
const icons = {
  note: <><path d="M5 7h14M5 12h14M5 17h9" /></>,
  todo: <><path d="M4 7l1.5 1.5L8 6M4 16l1.5 1.5L8 15M11 7h9M11 16h9" /></>,
  heading: <><path d="M6 5v14M18 5v14M6 12h12" /></>,
  line: <><path d="M5 19L19 5M19 5h-6M19 5v6" /></>,
  upload: <><path d="M7 3h7l4 4v14H7zM14 3v4h4M12 17v-6M9.5 13.5L12 11l2.5 2.5" /></>,
  column: <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M9 8h6" /></>,
  arrowStart: <><path d="M20 12H5M10 7l-5 5 5 5" /></>,
  arrowEnd: <><path d="M4 12h15M14 7l5 5-5 5" /></>,
  dashed: <><path d="M4 12h3M10.5 12h3M17 12h3" /></>,
  weight: <><path d="M4 7h16" strokeWidth="1" /><path d="M4 12h16" strokeWidth="2" /><path d="M4 17.5h16" strokeWidth="3.5" /></>,
  label: <><rect x="3" y="8" width="18" height="8" rx="4" /><path d="M8 12h8" /></>,
  trash: <><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></>,
  back: <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
  bullets: <><path d="M9 7h11M9 12h11M9 17h11" /><circle cx="4.5" cy="7" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="17" r="1" /></>,
  numbers: <><path d="M10 7h10M10 12h10M10 17h10M4 5.5l1.5-1v4M4 15h2.5L4 18.5h2.5" /></>,
  quote: <><path d="M5 5v14M10 8h9M10 12h9M10 16h6" /></>,
  title: <><path d="M4 6h16M4 11h10M4 16h10" /></>,
  rename: <><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></>,
  icon: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01" /></>,
}
const Icon = ({ name }) => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>

const tile = 'flex w-full flex-col items-center gap-1 rounded-lg py-2 text-[10px] text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30'
// Keeps the text cursor where it is while a formatting button is pressed.
const keepFocus = (e) => e.preventDefault()

function Tool({ type, label, onDragStart, hint }) {
  return (
    <div className="relative">
      <button type="button" onPointerDown={(e) => onDragStart(type, e)} className={`${tile} cursor-grab touch-none`} aria-label={`${label}: drag onto the board`}>
        {type === 'board'
          ? <span className="grid h-6 w-6 grid-cols-2 gap-0.5 rounded-md bg-blue-500 p-1.5" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className="rounded-[1px] bg-white/90" />)}</span>
          : <Icon name={type} />}
        {label}
      </button>
      {hint && <span role="tooltip" className="pointer-events-none absolute left-full top-2 z-30 ml-2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs font-semibold text-black">{note.dragMe}</span>}
    </div>
  )
}

// The left toolbar. With nothing selected it holds the card types to drag out and the trash;
// with cards selected it shows their options; while a note is being edited, text formatting.
export default function NoteToolbar({ selected, editor, onDragStart, hintFor, onBack, onColor, onTrash, onToggleTitle, onRename, onLine, onIcon, onUpload, onOpenTrash, trashCount }) {
  const [palette, setPalette] = useState(false)
  const single = selected.length === 1 ? selected[0] : null

  const toggle = (label, icon, on, run) => (
    <button key={label} type="button" onClick={run} aria-pressed={Boolean(on)} className={`${tile} ${on ? 'bg-white/15 text-white' : ''}`}><Icon name={icon} />{label}</button>
  )

  let content
  if (editor) {
    const style = (name, attrs) => (editor.isActive(name, attrs) ? 'bg-white/15 text-white' : '')
    const btn = (label, icon, active, run) => (
      <button key={label} type="button" onPointerDown={keepFocus} onClick={run} aria-label={label} aria-pressed={Boolean(active)} title={label} className={`${tile} ${active}`}>{icon}</button>
    )
    content = (
      <>
        <button type="button" onClick={onBack} className={tile} aria-label="Done editing"><Icon name="back" /></button>
        {btn('Large heading', <span className="text-base font-extrabold">H1</span>, style('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
        {btn('Heading', <span className="text-sm font-bold">H2</span>, style('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        {btn('Bold', <span className="text-base font-extrabold">B</span>, style('bold'), () => editor.chain().focus().toggleBold().run())}
        {btn('Italic', <span className="font-serif text-base italic">I</span>, style('italic'), () => editor.chain().focus().toggleItalic().run())}
        {btn('Strikethrough', <span className="text-base line-through">S</span>, style('strike'), () => editor.chain().focus().toggleStrike().run())}
        {btn('Bullet list', <Icon name="bullets" />, style('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
        {btn('Numbered list', <Icon name="numbers" />, style('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
        {btn('Quote', <Icon name="quote" />, style('blockquote'), () => editor.chain().focus().toggleBlockquote().run())}
      </>
    )
  } else if (selected.length) {
    content = (
      <>
        <button type="button" onClick={onBack} className={tile} aria-label="Deselect"><Icon name="back" /></button>
        <div className="relative">
          <button type="button" onClick={() => setPalette((p) => !p)} aria-expanded={palette} className={tile}>
            <span className="h-5 w-5 rounded border border-white/40 bg-gradient-to-br from-blue-500 via-pink-500 to-yellow-500" aria-hidden="true" />
            Color
          </button>
          {palette && (
            <div className="glass absolute left-full top-0 z-30 ml-2 grid w-44 grid-cols-5 gap-2 bg-neutral-900/90 p-3">
              {colors.map((c) => (
                <button key={c.key} type="button" onClick={() => { onColor(c.key); setPalette(false) }} aria-label={c.label} title={c.label} className={`h-6 w-6 rounded border border-white/30 ${c.swatch}`} />
              ))}
            </div>
          )}
        </div>
        {single?.type === 'todo' && <button type="button" onClick={onToggleTitle} aria-pressed={single.title != null} className={`${tile} ${single.title != null ? 'bg-white/15 text-white' : ''}`}><Icon name="title" />Title</button>}
        {single?.type === 'board' && <button type="button" onClick={onIcon} className={tile}><Icon name="icon" />Icon</button>}
        {(single?.type === 'board' || single?.type === 'column') && <button type="button" onClick={onRename} className={tile}><Icon name="rename" />Rename</button>}
        {single?.type === 'line' && (
          <>
            {toggle('Start', 'arrowStart', single.startArrow, () => onLine('startArrow', !single.startArrow))}
            {toggle('End', 'arrowEnd', single.endArrow, () => onLine('endArrow', !single.endArrow))}
            {toggle('Dashed', 'dashed', single.dashed, () => onLine('dashed', !single.dashed))}
            <button type="button" onClick={() => onLine('weight', ((single.weight ?? 2) % 3) + 1)} className={tile} aria-label={`Weight: ${single.weight ?? 2} of 3. Change`}><Icon name="weight" />Weight</button>
            <button type="button" onClick={onRename} className={tile}><Icon name="label" />Label</button>
          </>
        )}
        <button type="button" onClick={onTrash} className={tile}><Icon name="trash" />Delete</button>
      </>
    )
  } else {
    content = (
      <>
        {tools.map((t) => <Tool key={t.type} {...t} onDragStart={onDragStart} hint={hintFor === t.type} />)}
        <hr className="mx-2 my-1 border-white/10" />
        <button type="button" onClick={onUpload} className={tile} aria-label={note.uploadPdf} title={note.uploadPdf}><Icon name="upload" />{note.upload}</button>
        <button type="button" onClick={onOpenTrash} className={`${tile} mt-auto`}>
          <Icon name="trash" />
          {note.trash}{trashCount > 0 && ` (${trashCount})`}
        </button>
      </>
    )
  }

  return <aside className="glass-bar z-20 flex w-16 shrink-0 flex-col gap-1 overflow-y-auto border-r p-1.5" aria-label="Board tools">{content}</aside>
}
