import { EncryptedPDFError, PDFDocument } from '@cantoo/pdf-lib'
import { loadPdf } from '../pdf/loader'
import { renderDocument, type RenderedPage } from '../pdf/renderer'

export interface OpenedDocument {
  readonly name: string
  readonly bytes: Uint8Array
  readonly pages: readonly RenderedPage[]
}

export class DocumentError extends Error {}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

async function assertEditable(bytes: Uint8Array): Promise<void> {
  try {
    await PDFDocument.load(bytes.slice())
  } catch (error) {
    if (error instanceof EncryptedPDFError) throw new DocumentError('This PDF is password-protected or encrypted, so it can’t be edited.')
    throw new DocumentError('This file couldn’t be opened. It may be damaged or not a valid PDF.')
  }
}

export async function openDocument(file: File): Promise<OpenedDocument> {
  if (!isPdf(file)) throw new DocumentError('Please choose a PDF file.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  await assertEditable(bytes)
  const pages = await renderDocument(await loadPdf(bytes))
  return { name: file.name, bytes, pages }
}

export async function renderBytes(bytes: Uint8Array): Promise<readonly RenderedPage[]> {
  return renderDocument(await loadPdf(bytes))
}

export function signedFileName(original: string): string {
  return `${original.replace(/\.pdf$/i, '')}-signed.pdf`
}
