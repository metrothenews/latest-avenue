import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { getStoredFile } from '../../lib/assignments.js'
import { site } from '../../data/site.js'
import { team } from '../../data/team.js'

const copy = team.assignments

// Shows a file linked from a doc without leaving the site, in a large window over the page.
// `file`: { title, href, preview, mediaId } (null = closed).
// - mediaId: a file that was copied onto the site at the last Refresh (image, audio, video or
//   PDF): loaded from the site's own storage and shown / played directly.
// - otherwise (a file too large to copy) Google's embedded preview. That loads with the viewer's
//   own Google session, so they need access to the file in Drive.
export default function FileViewer({ file, onClose }) {
  const [media, setMedia] = useState(undefined) // { url, type } | undefined while loading | null if not stored
  const [loaded, setLoaded] = useState(0)

  useEffect(() => {
    setMedia(undefined)
    setLoaded(0)
    if (!file?.mediaId) return
    let current = true
    let url
    getStoredFile(file.mediaId, (fraction) => current && setLoaded(fraction))
      .then(async (stored) => {
        if (!stored) return current && setMedia(null)
        // A blob: address instead of the (very long) data: one, so large videos and PDFs play.
        const blob = await (await fetch(stored.dataUrl)).blob()
        if (!current) return
        url = URL.createObjectURL(blob)
        setMedia({ url, type: blob.type })
      })
      .catch(() => current && setMedia(null))
    return () => {
      current = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  const stored = file?.mediaId && media !== null
  return (
    <Modal open={Boolean(file)} onClose={onClose} title={file?.title ?? ''} width="max-w-5xl">
      {file && (stored ? (
        <div className="flex min-h-[12rem] flex-col items-center justify-center">
          {media === undefined && <p className="text-sm text-white/50" role="status">Loading… {loaded > 0 && `${Math.round(loaded * 100)}%`}</p>}
          {media?.type.startsWith('image/') && <img src={media.url} alt={file.title} className="max-h-[70vh] max-w-full rounded-xl" />}
          {media?.type.startsWith('audio/') && <audio src={media.url} controls className="w-full" />}
          {media?.type.startsWith('video/') && <video src={media.url} controls playsInline className="max-h-[70vh] max-w-full rounded-xl bg-black" />}
          {media?.type === 'application/pdf' && (
            <>
              <iframe title={file.title} src={media.url} className="h-[65vh] w-full rounded-xl border border-white/10 bg-white" />
              <p className="mt-3 self-start text-sm text-white/50">
                {copy.pdfNote} <a href={media.url} download={`${file.title}.pdf`} className="underline hover:text-white">{copy.download}</a>
              </p>
            </>
          )}
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
            {copy.live} {copy.noAccess.replace('{founder}', site.founder)}{' '}
            <a href={file.href} target="_blank" rel="noreferrer" className="underline hover:text-white">{copy.openInGoogle}</a>
          </p>
        </>
      ))}
    </Modal>
  )
}
