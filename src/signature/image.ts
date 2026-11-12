import { newId, type Signature } from '../editor/model'

const MAX_UPLOAD_WIDTH = 1000
const OPAQUE_BELOW = 200
const TRANSPARENT_ABOVE = 235
const TRIM_PADDING = 4

interface Bounds {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas 2D is not supported in this browser')
  return context
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function backgroundAlpha(lum: number, alpha: number): number {
  if (lum >= TRANSPARENT_ABOVE) return 0
  if (lum <= OPAQUE_BELOW) return alpha
  const keep = (TRANSPARENT_ABOVE - lum) / (TRANSPARENT_ABOVE - OPAQUE_BELOW)
  return Math.round(alpha * keep)
}

function removeLightBackground(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const output = createCanvas(canvas.width, canvas.height)
  const source = context2d(canvas).getImageData(0, 0, canvas.width, canvas.height)
  const pixels = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b, a] = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2], pixels.data[i + 3]]
    pixels.data[i + 3] = backgroundAlpha(luminance(r, g, b), a)
  }
  context2d(output).putImageData(pixels, 0, 0)
  return output
}

function inkBounds(canvas: HTMLCanvasElement): Bounds | null {
  const { data, width, height } = context2d(canvas).getImageData(0, 0, canvas.width, canvas.height)
  let [minX, minY, maxX, maxY] = [width, height, -1, -1]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < 0) return null
  const left = Math.max(0, minX - TRIM_PADDING)
  const top = Math.max(0, minY - TRIM_PADDING)
  return {
    left,
    top,
    width: Math.min(width, maxX + TRIM_PADDING + 1) - left,
    height: Math.min(height, maxY + TRIM_PADDING + 1) - top,
  }
}

function crop(canvas: HTMLCanvasElement, bounds: Bounds): HTMLCanvasElement {
  const output = createCanvas(bounds.width, bounds.height)
  context2d(output).drawImage(
    canvas,
    bounds.left, bounds.top, bounds.width, bounds.height,
    0, 0, bounds.width, bounds.height,
  )
  return output
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Could not export the signature image'))
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  const image = new Image()
  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That file could not be read as an image'))
    image.src = url
  }).finally(() => URL.revokeObjectURL(url))
}

function imageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, MAX_UPLOAD_WIDTH / image.naturalWidth)
  const canvas = createCanvas(image.naturalWidth * scale, image.naturalHeight * scale)
  context2d(canvas).drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function signatureFromCanvas(canvas: HTMLCanvasElement): Promise<Signature | null> {
  const bounds = inkBounds(canvas)
  if (!bounds) return null
  const trimmed = crop(canvas, bounds)
  const png = await canvasToPngBytes(trimmed)
  const url = URL.createObjectURL(new Blob([png.slice()], { type: 'image/png' }))
  return { id: newId(), png, url, width: trimmed.width, height: trimmed.height }
}

export async function signatureFromFile(file: File): Promise<Signature | null> {
  const image = await loadImage(file)
  return signatureFromCanvas(removeLightBackground(imageToCanvas(image)))
}

export { canvasToPngBytes, createCanvas, context2d }
