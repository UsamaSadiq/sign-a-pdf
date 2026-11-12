import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from '@cantoo/pdf-lib'
import { pdfUnitsPerFrameUnit, placeBaseline, placeBox, type PageFrame } from '../editor/geometry'
import { TEXT_LINE_HEIGHT, type Item, type SignatureItem, type TextItem } from '../editor/model'
import { baselineRatio, splitLines } from '../editor/text-metrics'
import { rasterizeText } from './text-raster'

const TEXT_RGB = rgb(0.067, 0.067, 0.067)

interface ExportContext {
  readonly doc: PDFDocument
  readonly font: PDFFont
  readonly baseline: number
  readonly images: Map<string, Promise<PDFImage>>
}

function embedOnce(context: ExportContext, key: string, png: Uint8Array): Promise<PDFImage> {
  const cached = context.images.get(key)
  if (cached) return cached
  const embedded = context.doc.embedPng(png)
  context.images.set(key, embedded)
  return embedded
}

function drawImageBox(page: PDFPage, image: PDFImage, frame: PageFrame, item: Item): void {
  const placement = placeBox(frame, item)
  page.drawImage(image, {
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    rotate: degrees(placement.angle),
  })
}

function canEncode(font: PDFFont, text: string): boolean {
  const supported = new Set(font.getCharacterSet())
  return [...text].every((character) => supported.has(character.codePointAt(0) ?? -1))
}

function drawVectorText(page: PDFPage, frame: PageFrame, item: TextItem, context: ExportContext): void {
  const fontFrame = item.fontRatio * frame.width
  const size = fontFrame * pdfUnitsPerFrameUnit(frame)
  splitLines(item.text).forEach((line, index) => {
    if (!line) return
    const lineY = item.y * frame.height + (index * TEXT_LINE_HEIGHT + context.baseline) * fontFrame
    const anchor = placeBaseline(frame, item.x, lineY)
    page.drawText(line, {
      x: anchor.x,
      y: anchor.y,
      size,
      font: context.font,
      color: TEXT_RGB,
      rotate: degrees(anchor.angle),
    })
  })
}

async function drawText(page: PDFPage, frame: PageFrame, item: TextItem, context: ExportContext): Promise<void> {
  if (canEncode(context.font, splitLines(item.text).join(''))) return drawVectorText(page, frame, item, context)
  const png = await rasterizeText(item, frame, context.baseline)
  drawImageBox(page, await embedOnce(context, item.id, png), frame, item)
}

async function drawSignature(page: PDFPage, frame: PageFrame, item: SignatureItem, context: ExportContext): Promise<void> {
  const image = await embedOnce(context, item.signature.id, item.signature.png)
  drawImageBox(page, image, frame, item)
}

export async function buildSignedPdf(
  original: Uint8Array,
  frames: readonly PageFrame[],
  items: readonly Item[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original.slice())
  const context: ExportContext = {
    doc,
    font: await doc.embedFont(StandardFonts.Helvetica),
    baseline: baselineRatio(),
    images: new Map(),
  }
  const pages = doc.getPages()
  for (const item of items) {
    const [page, frame] = [pages[item.page], frames[item.page]]
    if (item.kind === 'text') await drawText(page, frame, item, context)
    else await drawSignature(page, frame, item, context)
  }
  return doc.save()
}
