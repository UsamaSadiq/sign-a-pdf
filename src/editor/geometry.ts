import type { PageViewport } from 'pdfjs-dist'

export type Point = readonly [number, number]

export interface PageFrame {
  readonly width: number
  readonly height: number
  toPdf(x: number, y: number): Point
}

export interface FractionBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface Placement {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly angle: number
}

export interface Baseline {
  readonly x: number
  readonly y: number
  readonly angle: number
}

export function frameFromViewport(viewport: PageViewport): PageFrame {
  return {
    width: viewport.width,
    height: viewport.height,
    toPdf: (x, y) => {
      const [px, py] = viewport.convertToPdfPoint(x, y)
      return [px, py]
    },
  }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function angleDegrees(from: Point, to: Point): number {
  return (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI
}

export function pdfUnitsPerFrameUnit(frame: PageFrame): number {
  return distance(frame.toPdf(0, 0), frame.toPdf(1, 0))
}

export function placeBox(frame: PageFrame, box: FractionBox): Placement {
  const left = box.x * frame.width
  const top = box.y * frame.height
  const right = left + box.w * frame.width
  const bottom = top + box.h * frame.height
  const origin = frame.toPdf(left, bottom)
  const alongWidth = frame.toPdf(right, bottom)
  const alongHeight = frame.toPdf(left, top)
  return {
    x: origin[0],
    y: origin[1],
    width: distance(origin, alongWidth),
    height: distance(origin, alongHeight),
    angle: angleDegrees(origin, alongWidth),
  }
}

export function placeBaseline(frame: PageFrame, xFraction: number, yFrame: number): Baseline {
  const left = xFraction * frame.width
  const origin = frame.toPdf(left, yFrame)
  const ahead = frame.toPdf(left + 1, yFrame)
  return { x: origin[0], y: origin[1], angle: angleDegrees(origin, ahead) }
}
