import type { PageFrame } from '../editor/geometry'
import { TEXT_COLOR, TEXT_FONT_STACK, TEXT_LINE_HEIGHT, type TextItem } from '../editor/model'
import { splitLines } from '../editor/text-metrics'
import { canvasToPngBytes, context2d, createCanvas } from '../signature/image'

const PIXELS_PER_FRAME_UNIT = 3
const MAX_CANVAS_SIDE = 8000

export async function rasterizeText(item: TextItem, frame: PageFrame, baseline: number): Promise<Uint8Array> {
  const wanted = item.w * frame.width * PIXELS_PER_FRAME_UNIT
  const scale = PIXELS_PER_FRAME_UNIT * Math.min(1, MAX_CANVAS_SIDE / wanted)
  const canvas = createCanvas(item.w * frame.width * scale, item.h * frame.height * scale)
  const context = context2d(canvas)
  const fontPx = item.fontRatio * frame.width * scale
  context.font = `${fontPx}px ${TEXT_FONT_STACK}`
  context.fillStyle = TEXT_COLOR
  context.textBaseline = 'alphabetic'
  splitLines(item.text).forEach((line, index) => {
    context.fillText(line, 0, (index * TEXT_LINE_HEIGHT + baseline) * fontPx)
  })
  return canvasToPngBytes(canvas)
}
