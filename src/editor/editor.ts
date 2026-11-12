import type { RenderedPage } from '../pdf/renderer'
import { pageShell } from '../pdf/renderer'
import { frameFromViewport, type PageFrame } from './geometry'
import { applyLayout, createItemView, type ItemView } from './item-view'
import { ItemStore, newId, type Item, type ItemPatch, type Signature, type SignatureItem, type TextItem } from './model'
import { attachDrag, clamp } from './pointer'
import { textBoxSize } from './text-metrics'

const DEFAULT_FONT_RATIO = 16 / 900
const MIN_FONT_RATIO = 7 / 900
const MAX_FONT_RATIO = 120 / 900
const DEFAULT_SIGNATURE_WIDTH = 0.28
const MIN_SIGNATURE_WIDTH = 0.04

type Mode = { kind: 'idle' } | { kind: 'text' } | { kind: 'signature'; signature: Signature }

interface PageSlot {
  readonly shell: HTMLDivElement
  readonly overlay: HTMLDivElement
  readonly frame: PageFrame
}

export interface EditorElements {
  readonly pages: HTMLElement
  readonly hint: HTMLElement
  readonly hintText: HTMLElement
}

export class Editor {
  private readonly store = new ItemStore()
  private readonly views = new Map<string, ItemView>()
  private slots: PageSlot[] = []
  private mode: Mode = { kind: 'idle' }
  private selectedId: string | null = null

  private readonly ui: EditorElements

  constructor(ui: EditorElements) {
    this.ui = ui
    document.addEventListener('keydown', (event) => this.handleKey(event))
    document.addEventListener('pointerdown', (event) => this.handleOutsidePointer(event))
  }

  mount(pages: readonly RenderedPage[]): void {
    this.reset()
    this.slots = pages.map((page, index) => this.createSlot(page, index))
    this.ui.pages.replaceChildren(...this.slots.map((slot) => slot.shell))
  }

  reset(): void {
    this.store.clear()
    this.views.clear()
    this.slots = []
    this.selectedId = null
    this.setMode({ kind: 'idle' })
    this.ui.pages.replaceChildren()
  }

  beginText(): void {
    this.setMode({ kind: 'text' })
  }

  beginSignature(signature: Signature): void {
    this.setMode({ kind: 'signature', signature })
  }

  cancelPlacement(): void {
    this.setMode({ kind: 'idle' })
  }

  items(): Item[] {
    return this.store.list().filter((item) => item.kind !== 'text' || item.text.trim())
  }

  frames(): PageFrame[] {
    return this.slots.map((slot) => slot.frame)
  }

  private createSlot(page: RenderedPage, index: number): PageSlot {
    const shell = pageShell(page)
    const overlay = document.createElement('div')
    overlay.className = 'page__overlay'
    overlay.addEventListener('pointerdown', (event) => this.handlePagePointer(event, index))
    shell.append(overlay)
    return { shell, overlay, frame: frameFromViewport(page.viewport) }
  }

  private setMode(mode: Mode): void {
    this.mode = mode
    const placing = mode.kind !== 'idle'
    this.ui.pages.classList.toggle('is-placing', placing)
    this.ui.hint.hidden = !placing
    this.ui.hintText.textContent =
      mode.kind === 'text' ? 'Click on a page where the text should start.' : 'Click on a page to place your signature.'
  }

  private pageAspect(page: number): number {
    const { width, height } = this.slots[page].frame
    return width / height
  }

  private pointerFraction(event: PointerEvent, page: number): { x: number; y: number } {
    const rect = this.slots[page].overlay.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
  }

  private handlePagePointer(event: PointerEvent, page: number): void {
    if (event.target !== event.currentTarget) return
    if (this.mode.kind === 'idle') return this.select(null)
    event.preventDefault()
    const point = this.pointerFraction(event, page)
    const item = this.mode.kind === 'text' ? this.newText(page, point) : this.newSignature(page, point, this.mode.signature)
    this.setMode({ kind: 'idle' })
    this.addItem(item)
  }

  private newText(page: number, point: { x: number; y: number }): TextItem {
    const size = textBoxSize('', DEFAULT_FONT_RATIO, this.pageAspect(page))
    return {
      id: newId(),
      kind: 'text',
      page,
      text: '',
      fontRatio: DEFAULT_FONT_RATIO,
      x: clamp(point.x, 0, 1 - size.w),
      y: clamp(point.y - size.h / 2, 0, 1 - size.h),
      ...size,
    }
  }

  private signatureHeight(page: number, width: number, signature: Signature): number {
    return width * this.pageAspect(page) * (signature.height / signature.width)
  }

  private newSignature(page: number, point: { x: number; y: number }, signature: Signature): SignatureItem {
    const fitWidth = DEFAULT_SIGNATURE_WIDTH / Math.max(1, this.signatureHeight(page, DEFAULT_SIGNATURE_WIDTH, signature) / 0.25)
    const w = Math.min(fitWidth, 1)
    const h = this.signatureHeight(page, w, signature)
    return {
      id: newId(),
      kind: 'signature',
      page,
      signature,
      w,
      h,
      x: clamp(point.x - w / 2, 0, 1 - w),
      y: clamp(point.y - h / 2, 0, 1 - h),
    }
  }

  private addItem(item: Item): void {
    this.store.add(item)
    const view = createItemView(item)
    this.views.set(item.id, view)
    this.slots[item.page].overlay.append(view.root)
    this.wire(item.id, view)
    this.select(item.id)
    view.textarea?.focus()
  }

  private wire(id: string, view: ItemView): void {
    view.root.addEventListener('pointerdown', () => this.select(id))
    view.remove.addEventListener('pointerdown', (event) => event.stopPropagation())
    view.remove.addEventListener('click', () => this.removeItem(id))
    this.wireMove(id, view)
    this.wireResize(id, view)
    if (view.textarea) this.wireText(id, view.textarea)
  }

  private pageSize(page: number): DOMRect {
    return this.slots[page].overlay.getBoundingClientRect()
  }

  private wireMove(id: string, view: ItemView): void {
    let origin = { x: 0, y: 0 }
    attachDrag(view.grip, {
      onStart: () => {
        const item = this.store.get(id)
        if (item) origin = { x: item.x, y: item.y }
        this.select(id)
      },
      onMove: ({ dx, dy }) => {
        const item = this.store.get(id)
        if (!item) return
        const rect = this.pageSize(item.page)
        this.patch(id, {
          x: clamp(origin.x + dx / rect.width, 0, 1 - item.w),
          y: clamp(origin.y + dy / rect.height, 0, 1 - item.h),
        })
      },
    })
  }

  private wireResize(id: string, view: ItemView): void {
    let start: Item | null = null
    attachDrag(view.resize, {
      onStart: () => {
        start = this.store.get(id) ?? null
        this.select(id)
      },
      onMove: ({ dx }) => {
        if (!start) return
        const rect = this.pageSize(start.page)
        const scale = Math.max(0.05, (start.w + dx / rect.width) / start.w)
        this.patch(id, start.kind === 'text' ? this.scaledText(start, scale) : this.scaledSignature(start, scale))
      },
    })
  }

  private scaledText(item: TextItem, scale: number): ItemPatch {
    const fontRatio = clamp(item.fontRatio * scale, MIN_FONT_RATIO, MAX_FONT_RATIO)
    return this.fittedText(item, item.text, fontRatio)
  }

  private scaledSignature(item: SignatureItem, scale: number): ItemPatch {
    const maxByHeight = (1 - item.y) / this.signatureHeight(item.page, 1, item.signature)
    const w = clamp(item.w * scale, MIN_SIGNATURE_WIDTH, Math.min(1 - item.x, maxByHeight))
    return { w, h: this.signatureHeight(item.page, w, item.signature) }
  }

  private fittedText(item: TextItem, text: string, fontRatio: number): ItemPatch {
    const size = textBoxSize(text, fontRatio, this.pageAspect(item.page))
    return {
      text,
      fontRatio,
      ...size,
      x: clamp(item.x, 0, Math.max(0, 1 - size.w)),
      y: clamp(item.y, 0, Math.max(0, 1 - size.h)),
    }
  }

  private wireText(id: string, textarea: HTMLTextAreaElement): void {
    textarea.addEventListener('input', () => {
      const item = this.store.get(id)
      if (item?.kind === 'text') this.patch(id, this.fittedText(item, textarea.value, item.fontRatio))
    })
    textarea.addEventListener('blur', () => {
      const item = this.store.get(id)
      if (item?.kind === 'text' && !item.text.trim()) this.removeItem(id)
    })
  }

  private patch(id: string, patch: ItemPatch): void {
    const item = this.store.update(id, patch)
    const view = this.views.get(id)
    if (item && view) applyLayout(view, item)
  }

  private removeItem(id: string): void {
    this.views.get(id)?.root.remove()
    this.views.delete(id)
    this.store.remove(id)
    if (this.selectedId === id) this.selectedId = null
  }

  private select(id: string | null): void {
    this.selectedId = id
    this.views.forEach((view, viewId) => view.root.classList.toggle('is-selected', viewId === id))
  }

  private handleOutsidePointer(event: PointerEvent): void {
    const target = event.target as Element | null
    if (!target?.closest('.item, .page__overlay')) this.select(null)
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.mode.kind !== 'idle') return this.cancelPlacement()
    const editingText = (event.target as Element | null)?.closest('textarea, input')
    const deleting = event.key === 'Delete' || event.key === 'Backspace'
    if (deleting && !editingText && this.selectedId) {
      event.preventDefault()
      this.removeItem(this.selectedId)
    }
  }
}
