import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { getStoredFile } from '../../lib/assignments.js'
import { site } from '../../data/site.js'
import { team } from '../../data/team.js'

const copy = team.assignments

// Shows a file linked from a doc without leaving the site, in a large window over the page.
// `file`: { title, href, preview, mediaId } (null = closed).
// - mediaId: an image or audio file that was copied onto the site: shown / played directly.
// - otherwise Google's embedded preview (video, PDFs, sheets, folders, …). That loads with the
//   viewer's own Google session, so they need access to the file in Drive.
export default function FileViewer({ file, onClose }) {
  const [media, setMedia] = useState(undefined) // undefined while loading, null if not stored

  useEffect(() => {
    setMedia(undefined)
    if (!file?.mediaId) return
    let current = true
    getStoredFile(file.mediaId).then((m) => current && setMedia(m), () => current && setMedia(null))
    return () => { current = false }
  }, [file])

  const stored = file?.mediaId && media !== null
  return (
    <Modal open={Boolean(file)} onClose={onClose} title={file?.title ?? ''} width="max-w-5xl">
      {file && (stored ? (
        <div className="flex min-h-[12rem] items-center justify-center">
          {media === undefined && <p className="text-sm text-white/50">Loading…</p>}
          {media?.dataUrl.startsWith('data:image/') && <img src={media.dataUrl} alt={file.title} className="max-h-[70vh] max-w-full rounded-xl" />}
          {media?.dataUrl.startsWith('data:audio/') && <audio src={media.dataUrl} controls className="w-full" />}
        </div>
      ) : (
        <>
          <iframe
            title={file.title}
            src={file.preview}
            allow="autoplay; fullscreen"
            className="h-[65vh] w-full rounded-xl border border-white/10 bg-black/40"
          />
          <p className="mt-3 text-sm text-white/50">
            {copy.noAccess.replace('{founder}', site.founder)}{' '}
            <a href={file.href} target="_blank" rel="noreferrer" className="underline hover:text-white">{copy.openInGoogle}</a>
          </p>
        </>
      ))}
    </Modal>
  )
}
