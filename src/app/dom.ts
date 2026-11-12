export function required<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector)
  if (!element) throw new Error(`Missing element: ${selector}`)
  return element
}

export function onAction(name: string, handler: () => void): void {
  required(`[data-action="${name}"]`).addEventListener('click', handler)
}

export function showMessage(element: HTMLElement, message: string): void {
  element.textContent = message
  element.hidden = !message
}
