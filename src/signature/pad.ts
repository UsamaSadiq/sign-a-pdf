const STROKE_COLOR = '#0f1b3d'
const STROKE_WIDTH = 2.5

type Point = { x: number; y: number }

export class SignaturePad {
  private readonly context: CanvasRenderingContext2D
  private last: Point | null = null
  private hasInk = false

  private readonly canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas 2D is not supported in this browser')
    this.context = context
    canvas.addEventListener('pointerdown', (event) => this.start(event))
    canvas.addEventListener('pointermove', (event) => this.move(event))
    canvas.addEventListener('pointerup', () => this.end())
    canvas.addEventListener('pointercancel', () => this.end())
  }

  resize(): void {
    const ratio = window.devicePixelRatio || 1
    const { width, height } = this.canvas.getBoundingClientRect()
    const [pixelWidth, pixelHeight] = [Math.round(width * ratio), Math.round(height * ratio)]
    if (this.canvas.width === pixelWidth && this.canvas.height === pixelHeight) return
    this.canvas.width = pixelWidth
    this.canvas.height = pixelHeight
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0)
    this.context.lineCap = 'round'
    this.context.lineJoin = 'round'
    this.context.strokeStyle = STROKE_COLOR
    this.context.fillStyle = STROKE_COLOR
    this.context.lineWidth = STROKE_WIDTH
    this.hasInk = false
  }

  clear(): void {
    this.context.save()
    this.context.setTransform(1, 0, 0, 1, 0, 0)
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.context.restore()
    this.hasInk = false
  }

  isEmpty(): boolean {
    return !this.hasInk
  }

  get element(): HTMLCanvasElement {
    return this.canvas
  }

  private pointFrom(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  private start(event: PointerEvent): void {
    this.canvas.setPointerCapture(event.pointerId)
    const point = this.pointFrom(event)
    this.context.beginPath()
    this.context.arc(point.x, point.y, STROKE_WIDTH / 2, 0, Math.PI * 2)
    this.context.fill()
    this.last = point
    this.hasInk = true
  }

  private move(event: PointerEvent): void {
    if (!this.last) return
    const point = this.pointFrom(event)
    this.context.beginPath()
    this.context.moveTo(this.last.x, this.last.y)
    this.context.lineTo(point.x, point.y)
    this.context.stroke()
    this.last = point
  }

  private end(): void {
    this.last = null
  }
}
