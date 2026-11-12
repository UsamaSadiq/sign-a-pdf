export interface DragDelta {
  readonly dx: number
  readonly dy: number
}

export interface DragHandlers {
  onStart(): void
  onMove(delta: DragDelta): void
  onEnd?(): void
}

export function attachDrag(handle: HTMLElement, handlers: DragHandlers): void {
  handle.addEventListener('pointerdown', (start) => {
    if (start.button !== 0) return
    start.preventDefault()
    start.stopPropagation()
    handle.setPointerCapture(start.pointerId)
    handlers.onStart()
    const move = (event: PointerEvent) =>
      handlers.onMove({ dx: event.clientX - start.clientX, dy: event.clientY - start.clientY })
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      handlers.onEnd?.()
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  })
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
