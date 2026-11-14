import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { note } from '../../data/note.js'
import { HOME } from '../../lib/note.js'
import { site } from '../../data/site.js'

const crumbLink = 'flex min-w-0 items-center gap-1.5 text-white/60 hover:text-white'
const iconButton = 'rounded-md px-2 py-1 text-lg leading-none text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent'

// Two rows above a board: breadcrumbs with undo / redo, then save status, the title and Share.
export default function NoteHeader({ board, trail, canEdit, editable, onLock, saving, canUndo, canRedo, onUndo, onRedo, onRename, onShare, zoom, onZoom, onFit }) {
  const [title, setTitle] = useState(board.title)
  const [viewOpen, setViewOpen] = useState(false)
  useEffect(() => setTitle(board.title), [board.title])
  const renamable = editable && board.id !== HOME
  const locked = Boolean(board.locked)

  function commit() {
    const next = title.trim()
    if (next && next !== board.title) onRename(next)
    else setTitle(board.title)
  }

  return (
    <header className="glass-bar z-30 shrink-0 border-b">
      <div className="flex h-10 items-center justify-between gap-3 px-3 text-sm">
        <nav aria-label="Breadcrumbs" className="flex min-w-0 items-center gap-2">
          <Link to="/team/note" className="shrink-0 font-extrabold tracking-tight">{site.name}</Link>
          {trail.map((b) => (
            <span key={b.id} className="flex min-w-0 items-center gap-2">
              <span className="text-white/30">/</span>
              <Link to={b.id === HOME ? '/team/note/home' : `/team/note/${b.id}`} className={crumbLink}>
                {b.id !== HOME && <span className="h-3 w-3 shrink-0 rounded-sm bg-neutral-600" aria-hidden="true" />}
                <span className="truncate">{b.title}</span>
              </Link>
            </span>
          ))}
          <span className="text-white/30">/</span>
          <span className="flex min-w-0 items-center gap-1.5" aria-current="page">
            {board.id !== HOME && <span className="h-3 w-3 shrink-0 rounded-sm bg-neutral-600" aria-hidden="true" />}
            <span className="truncate">{board.title}</span>
          </span>
        </nav>
        {editable && (
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo" className={iconButton}>↶</button>
            <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo" className={iconButton}>↷</button>
          </div>
        )}
      </div>
      {/* On a phone the title takes the room that's left; on wider screens it sits in the middle. */}
      <div className="flex h-11 items-center gap-2 border-t border-white/5 px-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
        <span className="hidden text-xs text-white/40 sm:block" role="status">{editable ? (saving ? note.saving : note.saved) : locked ? note.lockedStatus : ''}</span>
        {/* The board's name with its lock switch beside it. */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:justify-center">
        {renamable ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setTitle(board.title); e.target.blur() } }}
            aria-label="Board name"
            className="min-w-0 flex-1 rounded bg-transparent text-left text-lg font-bold tracking-tight outline-none hover:bg-white/5 focus:bg-white/10 sm:w-[min(40vw,24rem)] sm:flex-none sm:text-center"
          />
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-left text-lg font-bold tracking-tight sm:flex-none sm:text-center">{board.title}</h1>
        )}
        {/* Lock: a team member can make the board read-only (for everyone) so nothing gets changed by accident. */}
        {canEdit && (
          <button
            type="button" role="switch" aria-checked={locked} aria-label={note.lockLabel} title={locked ? note.unlockHint : note.lockHint}
            onClick={() => onLock(!locked)}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2 ${locked ? 'border-white/40 bg-white/15 text-white' : 'border-white/15 text-white/50 hover:text-white'}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d={locked ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-2'} />
            </svg>
            <span className={`relative h-4 w-7 rounded-full ${locked ? 'bg-white' : 'bg-white/20'}`} aria-hidden="true">
              <span className={`absolute top-0.5 h-3 w-3 rounded-full ${locked ? 'left-3.5 bg-neutral-900' : 'left-0.5 bg-white/70'}`} />
            </span>
          </button>
        )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <div className="relative">
            <button type="button" onClick={() => setViewOpen((o) => !o)} aria-expanded={viewOpen} className="rounded-full px-2.5 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white">
              {zoom === 1 ? note.view : `${Math.round(zoom * 100)}%`} ▾
            </button>
            {viewOpen && (
              <div className="glass absolute right-0 top-full z-40 mt-2 w-56 bg-neutral-900/95 p-3 text-sm">
                <p className="text-xs text-white/50">Zoom (or hold Ctrl / ⌘ and scroll)</p>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => onZoom(zoom - 0.1)} aria-label="Zoom out" className={iconButton}>−</button>
                  <button type="button" onClick={() => onZoom(1)} aria-label="Reset zoom to 100%" className="flex-1 rounded-md border border-white/15 py-1 tabular-nums hover:bg-white/10">{Math.round(zoom * 100)}%</button>
                  <button type="button" onClick={() => onZoom(zoom + 0.1)} aria-label="Zoom in" className={iconButton}>+</button>
                </div>
                <button type="button" onClick={() => { onFit(); setViewOpen(false) }} className="mt-3 flex w-full items-center justify-between rounded-md border border-white/15 px-3 py-1.5 hover:bg-white/10">
                  {note.fit}<span className="text-xs text-white/40">Z</span>
                </button>
              </div>
            )}
          </div>
          {canEdit
            ? <button type="button" onClick={onShare} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-semibold hover:bg-white/10">{note.share}{board.public && ' · on'}</button>
            : <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-white/60">{note.viewOnly}</span>}
        </div>
      </div>
    </header>
  )
}
