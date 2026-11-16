// The pieces of ALIBI.EXE's late-90s desktop look (styles: .w9-* in index.css). Sizes are in em,
// so each page sets one font size and everything scales from it.

// A window: navy title bar, optional menu bar and status bar. `status` is a list of cells.
export function Window({ title, menu, status, children, className = '', bodyClass = 'p-[0.9em]' }) {
  return (
    <section className={`w9 w9-raised flex flex-col p-[3px] ${className}`}>
      <header className="w9-title flex h-[1.7em] shrink-0 items-center justify-between gap-2 px-[0.35em]">
        <h2 className="truncate">{title}</h2>
        <span className="w9-raised flex h-[1.25em] w-[1.4em] shrink-0 items-center justify-center text-[0.8em] font-bold leading-none text-black" aria-hidden="true">✕</span>
      </header>
      {menu && <p className="flex shrink-0 gap-[1em] px-[0.5em] py-[0.15em]" aria-hidden="true">{menu.map((m) => <span key={m}><u>{m[0]}</u>{m.slice(1)}</span>)}</p>}
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
      {status && (
        <footer className="flex shrink-0 gap-[2px] pt-[2px]">
          {status.map((cell, i) => <p key={i} className={`w9-well truncate px-[0.4em] py-[0.1em] ${i === 0 ? 'flex-1' : 'shrink-0'}`}>{cell}</p>)}
        </footer>
      )}
    </section>
  )
}

export function WinButton({ className = '', children, ...props }) {
  return <button type="button" className={`w9-btn min-h-[2.2em] px-[1.2em] ${className}`} {...props}>{children}</button>
}

// A progress bar made of blocks. `value` is 0 to 1.
export function Progress({ value, blocks = 24, className = '' }) {
  const filled = Math.max(0, Math.min(blocks, Math.ceil(value * blocks)))
  return (
    <div className={`w9-well flex h-[1.4em] gap-[2px] bg-[#c0c0c0] p-[3px] ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      {Array.from({ length: blocks }, (_, i) => <span key={i} className={`flex-1 ${i < filled ? 'bg-[#000080]' : ''}`} />)}
    </div>
  )
}

// The round icons in message boxes: 'error' (red, a cross) or 'ask' (blue, a question mark).
export function BoxIcon({ kind = 'ask', className = 'h-[2.6em] w-[2.6em]' }) {
  return (
    <svg viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill={kind === 'error' ? '#d40000' : '#1c3cc4'} stroke="#000" strokeWidth="1" />
      {kind === 'error'
        ? <path d="M10 10l12 12M22 10L10 22" stroke="#fff" strokeWidth="3.5" strokeLinecap="square" />
        : <text x="16" y="23" textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff" fontFamily="Georgia, serif">?</text>}
    </svg>
  )
}
