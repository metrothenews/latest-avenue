// A PDF as a slideshow: opens it once and draws pages to canvases on request (kept, so going
// back and forth is instant). Uses pdf.js, loaded only when a slideshow is first needed.
import { loadPdfjs } from './pdf.js'

// `source` is a PDF's address, or its bytes (or a promise of them).
export function openSlides(source, size = 1600) {
  const pages = new Map() // page number → Promise<canvas>
  const doc = Promise.all([loadPdfjs(), source]).then(([pdfjs, src]) => pdfjs.getDocument(typeof src === 'string' ? { url: src } : { data: src }).promise)
  const first = doc.then((d) => d.getPage(1)).then((page) => page.getViewport({ scale: 1 }))

  function page(number) {
    if (!pages.has(number)) {
      pages.set(number, doc.then(async (d) => {
        const p = await d.getPage(number)
        const base = p.getViewport({ scale: 1 })
        const viewport = p.getViewport({ scale: size / base.width })
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        await p.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        return canvas
      }))
      pages.get(number).catch(() => pages.delete(number))
    }
    return pages.get(number)
  }

  return {
    // { count, ratio }: how many slides, and their shape (width / height).
    info: Promise.all([doc, first]).then(([d, v]) => ({ count: d.numPages, ratio: v.width / v.height })),
    page,
    close: () => doc.then((d) => d.destroy(), () => {}),
  }
}
