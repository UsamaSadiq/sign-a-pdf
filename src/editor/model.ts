export interface Signature {
  readonly id: string
  readonly png: Uint8Array
  readonly url: string
  readonly width: number
  readonly height: number
}

interface ItemBase {
  readonly id: string
  readonly page: number
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface TextItem extends ItemBase {
  readonly kind: 'text'
  readonly text: string
  readonly fontRatio: number
}

export interface SignatureItem extends ItemBase {
  readonly kind: 'signature'
  readonly signature: Signature
}

export type Item = TextItem | SignatureItem

export type ItemPatch = Partial<Pick<TextItem, 'x' | 'y' | 'w' | 'h' | 'text' | 'fontRatio'>>

export const TEXT_LINE_HEIGHT = 1.2
export const TEXT_FONT_STACK = 'Helvetica, Arial, sans-serif'
export const TEXT_COLOR = '#111111'

export function newId(): string {
  return crypto.randomUUID()
}

export class ItemStore {
  private items = new Map<string, Item>()

  list(): Item[] {
    return [...this.items.values()]
  }

  get(id: string): Item | undefined {
    return this.items.get(id)
  }

  add(item: Item): void {
    this.items.set(item.id, item)
  }

  update(id: string, patch: ItemPatch): Item | undefined {
    const current = this.items.get(id)
    if (!current) return undefined
    const next = { ...current, ...patch } as Item
    this.items.set(id, next)
    return next
  }

  remove(id: string): void {
    this.items.delete(id)
  }

  clear(): void {
    this.items.clear()
  }
}
