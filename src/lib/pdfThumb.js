// A picture of a PDF's first page, for its card on a note board. Loaded only when a PDF is added.
const WIDTH = 600 // pixels: twice the card's width, so it's sharp

// → { thumb: a JPEG data: URL (or '' if the PDF couldn't be drawn), pages: number of pages }
export async function pdfPreview(file) {
  try {
    const [pdfjs, { default: workerSrc }] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
    const doc = await task.promise
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: WIDTH / page.getViewport({ scale: 1 }).width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    // Only the top of a tall page is shown on the card.
    canvas.height = Math.round(Math.min(viewport.height, viewport.width * 1.1))
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, canvas, viewport }).promise
    const result = { thumb: canvas.toDataURL('image/jpeg', 0.72), pages: doc.numPages }
    // Free the PDF; a failure here mustn't lose the picture that's already drawn.
    Promise.resolve(task.destroy()).catch(() => {})
    return result
  } catch {
    return { thumb: '', pages: null }
  }
}
