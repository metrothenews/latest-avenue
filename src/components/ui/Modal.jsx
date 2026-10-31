import { useEffect } from 'react'

// Closes on Escape, backdrop click or the X button. Locks page scroll while open.
// `width` overrides the max width, e.g. "max-w-5xl" for previews.
export default function Modal({ open, onClose, title, width = 'max-w-lg', children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full ${width} overflow-y-auto rounded-2xl glass bg-neutral-900/60 p-8 backdrop-blur-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="min-w-0 break-words text-2xl font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-white/50 hover:text-white">✕</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
