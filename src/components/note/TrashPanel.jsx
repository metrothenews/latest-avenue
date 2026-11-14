import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { note } from '../../data/note.js'

const plain = (html) => new DOMParser().parseFromString(html ?? '', 'text/html').body.textContent.trim()

// A short description of a card for the trash list.
function summary(card, children) {
  if (card.type === 'note') return plain(card.html) || 'Empty note'
  if (card.type === 'heading') return card.text || 'Empty heading'
  if (card.type === 'todo') return card.title || card.items?.[0]?.text || 'Empty to-do list'
  return `Board: ${children.get(card.boardId)?.title || note.newBoard}`
}

// This board's trashed cards: restore one, or delete them all for good.
export default function TrashPanel({ open, onClose, cards, children, onRestore, onEmpty }) {
  return (
    <Modal open={open} onClose={onClose} title={note.trash}>
      {cards.length === 0 && <p className="text-sm text-white/50">{note.trashEmpty}</p>}
      <ul className="divide-y divide-white/10">
        {cards.map((card) => (
          <li key={card.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span className="min-w-0 truncate text-white/80">{summary(card, children)}</span>
            <button type="button" onClick={() => onRestore(card.id)} className="shrink-0 text-white/60 underline hover:text-white">{note.restore}</button>
          </li>
        ))}
      </ul>
      {cards.length > 0 && <Button variant="secondary" className="mt-5" onClick={onEmpty}>{note.emptyTrash}</Button>}
    </Modal>
  )
}
