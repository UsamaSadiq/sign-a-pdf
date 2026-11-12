import { loadPdf } from './pdf/loader'
import { renderDocument } from './pdf/renderer'

const input = document.querySelector<HTMLInputElement>('#pdf-input')!
const pagesContainer = document.querySelector<HTMLDivElement>('#pages')!

async function readSelectedFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

input.addEventListener('change', async () => {
  const file = input.files?.[0]
  if (!file) return
  const pdf = await loadPdf(await readSelectedFile(file))
  pagesContainer.replaceChildren(...(await renderDocument(pdf)))
})
