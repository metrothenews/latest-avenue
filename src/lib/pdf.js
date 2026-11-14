// pdf.js (the PDF drawing library), loaded on demand and set up once. Used to draw a PDF's first
// page for its card and to show whole PDFs in the viewer.
let ready
export function loadPdfjs() {
  ready ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([pdfjs, { default: workerSrc }]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    return pdfjs
  })
  ready.catch(() => { ready = undefined }) // let a later try start afresh
  return ready
}
