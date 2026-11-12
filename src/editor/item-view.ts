import type { Item, SignatureItem, TextItem } from './model'

export interface ItemView {
  readonly root: HTMLDivElement
  readonly grip: HTMLElement
  readonly resize: HTMLElement
  readonly remove: HTMLButtonElement
  readonly textarea?: HTMLTextAreaElement
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  return node
}

function controls(): Pick<ItemView, 'resize' | 'remove'> {
  const remove = element('button', 'item__delete')
  remove.type = 'button'
  remove.setAttribute('aria-label', 'Remove')
  remove.textContent = '×'
  const resize = element('span', 'item__resize')
  resize.setAttribute('aria-hidden', 'true')
  return { remove, resize }
}

function textView(item: TextItem): ItemView {
  const root = element('div', 'item item--text')
  const grip = element('span', 'item__grip')
  grip.title = 'Drag to move'
  const textarea = element('textarea', 'item__text')
  textarea.rows = 1
  textarea.wrap = 'off'
  textarea.spellcheck = false
  textarea.placeholder = 'Type here'
  textarea.value = item.text
  const { remove, resize } = controls()
  root.append(grip, textarea, remove, resize)
  return { root, grip, resize, remove, textarea }
}

function signatureView(item: SignatureItem): ItemView {
  const root = element('div', 'item item--signature')
  const image = element('img', 'item__image')
  image.src = item.signature.url
  image.alt = 'Signature'
  image.draggable = false
  const { remove, resize } = controls()
  root.append(image, remove, resize)
  return { root, grip: root, resize, remove }
}

export function createItemView(item: Item): ItemView {
  const view = item.kind === 'text' ? textView(item) : signatureView(item)
  view.root.dataset.id = item.id
  applyLayout(view, item)
  return view
}

const percent = (fraction: number) => `${fraction * 100}%`

export function applyLayout(view: ItemView, item: Item): void {
  const style = view.root.style
  style.left = percent(item.x)
  style.top = percent(item.y)
  style.width = percent(item.w)
  style.height = percent(item.h)
  if (item.kind === 'text') style.setProperty('--font-ratio', String(item.fontRatio))
}
