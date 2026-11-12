import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

const RENDER_SCALE = 1.5

async function renderPage(page: PDFPageProxy): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: RENDER_SCALE })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvas, viewport }).promise
  return canvas
}

export async function renderDocument(pdf: PDFDocumentProxy): Promise<HTMLCanvasElement[]> {
  const pageNumbers = Array.from({ length: pdf.numPages }, (_, i) => i + 1)
  const pages = await Promise.all(pageNumbers.map((n) => pdf.getPage(n)))
  return Promise.all(pages.map(renderPage))
}
