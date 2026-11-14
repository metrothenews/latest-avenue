import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { loadFile } from '../../lib/note.js'
import { note } from '../../data/note.js'

// Opens a PDF card's file in a large window over the board: loaded from the site, shown in the
// browser's own PDF viewer, with a download link (some phones can't show PDFs inline).
// `card`: the file card to show, or null when closed.
export default function PdfViewer({ card, onClose }) {
  const [url, setUrl] = useState('')
  const [loaded, setLoaded] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setUrl('')
    setLoaded(0)
    setFailed(false)
    if (!card) return
    let live = true
    let made
    loadFile(card.fileId, (fraction) => live && setLoaded(fraction)).then((blob) => {
      if (!live) return
      made = URL.createObjectURL(blob)
      setUrl(made)
    }, () => live && setFailed(true))
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [card])

  return (
    <Modal open={Boolean(card)} onClose={onClose} title={card?.name ?? ''} width="max-w-5xl">
      {failed && <p className="text-sm text-red-300/90" role="alert">{note.fileGone}</p>}
      {card && !url && !failed && <p className="py-16 text-center text-sm text-white/50" role="status">Loading… {loaded > 0 && `${Math.round(loaded * 100)}%`}</p>}
      {/* `card` is checked too: for one render after closing, the address is still set but the card is gone. */}
      {card && url && (
        <>
          <iframe title={card.name} src={url} className="h-[68vh] w-full rounded-xl border border-white/10 bg-white" />
          <p className="mt-3 text-sm text-white/50">
            {note.pdfNote} <a href={url} download={card.name} className="underline hover:text-white">{note.download}</a>
          </p>
        </>
      )}
    </Modal>
  )
}
