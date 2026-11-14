import { useEffect, useRef } from 'react'

// A right-click menu at (x, y). items: [{ label, hint, onSelect, disabled } | null for a divider].
// Closes on a click elsewhere, Esc, or once an item is chosen.
export default function ContextMenu({ x, y, items, onClose }) {
  const menu = useRef(null)
  useEffect(() => {
    const away = (e) => { if (!menu.current?.contains(e.target)) onClose() }
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key, true)
    menu.current?.querySelector('button:not(:disabled)')?.focus()
    return () => {
      window.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [onClose])

  // Keep it on screen.
  const left = Math.min(x, window.innerWidth - 232)
  const top = Math.min(y, window.innerHeight - items.length * 30 - 16)
  return (
    <div ref={menu} role="menu" className="glass fixed z-[70] w-56 bg-neutral-900/95 py-1.5 text-sm shadow-xl" style={{ left: Math.max(8, left), top: Math.max(8, top) }} onContextMenu={(e) => e.preventDefault()}>
      {items.map((item, i) => (item ? (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => { onClose(); item.onSelect() }}
          className="flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left hover:bg-white/10 focus:bg-white/10 focus:outline-none disabled:opacity-35 disabled:hover:bg-transparent"
        >
          {item.label}
          {item.hint && <span className="text-xs text-white/40">{item.hint}</span>}
        </button>
      ) : <hr key={`divider-${i}`} className="my-1.5 border-white/10" />))}
    </div>
  )
}
