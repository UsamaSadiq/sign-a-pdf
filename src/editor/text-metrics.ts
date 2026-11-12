import { TEXT_FONT_STACK, TEXT_LINE_HEIGHT } from './model'

const PROBE_SIZE = 100
const FALLBACK_BASELINE = 0.9

export function baselineRatio(): number {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return FALLBACK_BASELINE
  context.font = `${PROBE_SIZE}px ${TEXT_FONT_STACK}`
  const metrics = context.measureText('Hg')
  const ascent = metrics.fontBoundingBoxAscent / PROBE_SIZE
  const descent = metrics.fontBoundingBoxDescent / PROBE_SIZE
  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) return FALLBACK_BASELINE
  return (TEXT_LINE_HEIGHT - ascent - descent) / 2 + ascent
}

export function splitLines(text: string): string[] {
  return text.split(/\r?\n/)
}

const MEASURE_SIZE = 1000
const CARET_ALLOWANCE = 0.6
const EMPTY_WIDTH_EMS = 5

let measureContext: CanvasRenderingContext2D | null = null

function measurer(): CanvasRenderingContext2D | null {
  measureContext ??= document.createElement('canvas').getContext('2d')
  if (measureContext) measureContext.font = `${MEASURE_SIZE}px ${TEXT_FONT_STACK}`
  return measureContext
}

function widestLineEms(lines: readonly string[]): number {
  const context = measurer()
  const longest = Math.max(...lines.map((line) => line.length))
  if (!context) return longest * 0.6
  return Math.max(...lines.map((line) => context.measureText(line).width / MEASURE_SIZE))
}

export function textBoxSize(text: string, fontRatio: number, pageAspect: number): { w: number; h: number } {
  const lines = splitLines(text)
  const widthEms = text ? widestLineEms(lines) + CARET_ALLOWANCE : EMPTY_WIDTH_EMS
  return {
    w: widthEms * fontRatio,
    h: lines.length * TEXT_LINE_HEIGHT * fontRatio * pageAspect,
  }
}
