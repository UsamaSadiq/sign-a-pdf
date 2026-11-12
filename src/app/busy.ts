import { required } from './dom'

export async function whileBusy<T>(label: string, task: () => Promise<T>): Promise<T> {
  const overlay = required('[data-busy]')
  required('[data-busy-text]').textContent = label
  overlay.hidden = false
  try {
    return await task()
  } finally {
    overlay.hidden = true
  }
}
