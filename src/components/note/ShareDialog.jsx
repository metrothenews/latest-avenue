import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { note } from '../../data/note.js'

// Turns a board's read-only link on or off and shows the link to copy.
export default function ShareDialog({ open, onClose, board, onToggle }) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/team/note/${board.id}`

  async function toggle() {
    setBusy(true)
    try {
      await onToggle(!board.public)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    await navigator.clipboard?.writeText(link)
    setCopied(true)
  }

  return (
    <Modal open={open} onClose={onClose} title={note.shareTitle}>
      <p className="text-sm text-white/60">{note.shareText}</p>
      <label className="mt-5 flex items-center gap-3 text-sm">
        <input type="checkbox" role="switch" checked={Boolean(board.public)} disabled={busy} onChange={toggle} className="h-4 w-4 accent-white" />
        {note.shareToggle}: <b>{busy ? '…' : board.public ? 'on' : 'off'}</b>
      </label>
      <div className={`mt-4 flex gap-3 ${board.public ? '' : 'opacity-40'}`}>
        <input readOnly value={link} aria-label="Link to this board" onFocus={(e) => e.target.select()} className={fieldClass(false)} />
        <Button variant="secondary" className="shrink-0" disabled={!board.public} onClick={copy}>{copied ? note.copied : note.copyLink}</Button>
      </div>
    </Modal>
  )
}
