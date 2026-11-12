export type ViewName = 'landing' | 'editor' | 'preview' | 'done'

export function showView(name: ViewName): void {
  document.querySelectorAll<HTMLElement>('section[data-view]').forEach((view) => {
    view.hidden = view.dataset.view !== name
  })
  window.scrollTo({ top: 0 })
}
