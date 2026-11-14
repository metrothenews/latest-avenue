import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadFile } from '../../lib/note.js'
import { loadPdfjs } from '../../lib/pdf.js'
import { note } from '../../data/note.js'

const MAX_WIDTH = 900 // widest a page is drawn at 100% on a big screen
const ZOOMS = [1, 1.5, 2, 3]
const button = 'flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-lg text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30'

// One page, drawn when it comes near the screen. `width` is how wide to show it (CSS pixels).
function Page({ doc, number, width, ratio, root }) {
  const holder = useRef(null)
  const canvas = useRef(null)
  const [near, setNear] = useState(number === 1)
  const [shape, setShape] = useState(ratio) // this page's own height ÷ width, once known

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { root: root.current, rootMargin: '900px 0px' })
    observer.observe(holder.current)
    return () => observer.disconnect()
  }, [root])

  useEffect(() => {
    if (!near || !width) return
    let task
    let live = true
    doc.getPage(number).then((page) => {
      if (!live) return
      const base = page.getViewport({ scale: 1 })
      setShape(base.height / base.width)
      // Sharp on high-density screens, without drawing more pixels than a phone can hold.
      const density = Math.min(window.devicePixelRatio || 1, 2, 2600 / width)
      const viewport = page.getViewport({ scale: (width / base.width) * density })
      const el = canvas.current
      el.width = Math.round(viewport.width)
      el.height = Math.round(viewport.height)
      task = page.render({ canvasContext: el.getContext('2d'), canvas: el, viewport })
      task.promise.catch(() => {}) // cancelled when zoom changes or the viewer closes
    }, () => {})
    return () => {
      live = false
      task?.cancel()
    }
  }, [doc, number, near, width])

  return (
    <div ref={holder} className="mx-auto bg-white shadow-lg shadow-black/40" style={{ width, height: Math.round(width * shape) }}>
      <canvas ref={canvas} className="block h-full w-full" aria-label={`Page ${number}`} role="img" />
    </div>
  )
}

// Shows a PDF card's file over the whole screen, on any device: every page is drawn here (the
// browser's own PDF reader can't be relied on inside a page, least of all on phones). Scroll
// through the pages, zoom with the buttons, or download the file.
// `card`: the file card to show, or null when closed.
export default function PdfViewer({ card, onClose }) {
  const [pdf, setPdf] = useState(null) // { doc, pages, ratio, url }
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [room, setRoom] = useState(0) // width available for a page
  const scroller = useRef(null)
  const fileId = card?.fileId

  useEffect(() => {
    setPdf(null)
    setFailed(false)
    setZoom(1)
    if (!fileId) return
    let live = true
    let task
    let url
    Promise.all([loadFile(fileId), loadPdfjs()]).then(async ([blob, pdfjs]) => {
      task = pdfjs.getDocument({ data: await blob.arrayBuffer() })
      const doc = await task.promise
      const first = (await doc.getPage(1)).getViewport({ scale: 1 })
      if (!live) return
      url = URL.createObjectURL(blob)
      setPdf({ doc, pages: doc.numPages, ratio: first.height / first.width, url })
    }).catch(() => live && setFailed(true))
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
      Promise.resolve(task?.destroy()).catch(() => {})
    }
  }, [fileId])

  const place = useRef(null) // how far down the document we were, just before a zoom
  useLayoutEffect(() => {
    if (place.current == null || !scroller.current) return
    scroller.current.scrollTop = place.current * scroller.current.scrollHeight
    place.current = null
  }, [zoom])

  const open = Boolean(card)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const el = scroller.current
    const measure = () => setRoom(el.clientWidth - 24)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => {
      document.removeEventListener('keydown', onKey)
      observer.disconnect()
    }
  }, [open, onClose])

  if (!card) return null
  const width = Math.max(0, Math.round(Math.min(room, MAX_WIDTH) * zoom))
  // Zooming keeps your place: the same part of the document stays at the top of the screen.
  function step(by) {
    const el = scroller.current
    place.current = el.scrollHeight ? el.scrollTop / el.scrollHeight : 0
    setZoom(ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(zoom) + by))])
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={card.name} className="fixed inset-0 z-[80] flex flex-col bg-neutral-950">
      <header className="glass-bar flex shrink-0 items-center gap-1 border-b px-2 py-1.5 sm:gap-2 sm:px-4">
        <div className="min-w-0 flex-1 px-1">
          <h2 className="truncate text-sm font-semibold sm:text-base">{card.name}</h2>
          {pdf && <p className="text-xs text-white/50">{pdf.pages} page{pdf.pages === 1 ? '' : 's'}</p>}
        </div>
        <button type="button" onClick={() => step(-1)} disabled={!pdf || zoom === ZOOMS[0]} aria-label={note.zoomOut} title={note.zoomOut} className={button}>−</button>
        <span className="w-11 text-center text-xs tabular-nums text-white/60" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => step(1)} disabled={!pdf || zoom === ZOOMS.at(-1)} aria-label={note.zoomIn} title={note.zoomIn} className={button}>+</button>
        {pdf && (
          <a href={pdf.url} download={card.name} aria-label={note.download} title={note.download} className={button}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" /></svg>
          </a>
        )}
        <button type="button" onClick={onClose} aria-label={note.close} title={note.close} className={button}>✕</button>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {failed && <p className="p-6 text-sm text-red-300/90" role="alert">{note.fileGone}</p>}
        {!pdf && !failed && <p className="p-10 text-center text-sm text-white/50" role="status">{note.loadingPdf}</p>}
        {pdf && width > 0 && (
          // As wide as the widest page, so a zoomed-in page scrolls sideways instead of being cut off.
          <div className="flex flex-col gap-3 p-3" style={{ width: Math.max(width + 24, room + 24) }}>
            {Array.from({ length: pdf.pages }, (_, i) => <Page key={`${i}-${width}`} doc={pdf.doc} number={i + 1} width={width} ratio={pdf.ratio} root={scroller} />)}
          </div>
        )}
      </div>
    </div>
  )
}
