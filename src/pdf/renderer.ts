import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist'

const PAGE_CSS_WIDTH = 900
const MAX_PIXEL_RATIO = 2

export interface RenderedPage {
  readonly canvas: HTMLCanvasElement
  readonly viewport: PageViewport
}

function renderScale(page: PDFPageProxy): number {
  const baseWidth = page.getViewport({ scale: 1 }).width
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  return (PAGE_CSS_WIDTH * pixelRatio) / baseWidth
}

async function renderPage(page: PDFPageProxy): Promise<RenderedPage> {
  const viewport = page.getViewport({ scale: renderScale(page) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvas, viewport }).promise
  return { canvas, viewport }
}

export async function renderDocument(pdf: PDFDocumentProxy): Promise<RenderedPage[]> {
  const pageNumbers = Array.from({ length: pdf.numPages }, (_, i) => i + 1)
  const pages = await Promise.all(pageNumbers.map((n) => pdf.getPage(n)))
  return Promise.all(pages.map(renderPage))
}

export function pageShell(page: RenderedPage): HTMLDivElement {
  const shell = document.createElement('div')
  shell.className = 'page'
  shell.style.aspectRatio = `${page.viewport.width} / ${page.viewport.height}`
  shell.append(page.canvas)
  return shell
}
