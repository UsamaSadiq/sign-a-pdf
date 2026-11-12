import './style.css'
import { whileBusy } from './app/busy'
import { DocumentError, openDocument, renderBytes, signedFileName, type OpenedDocument } from './app/document'
import { onAction, required, showMessage } from './app/dom'
import { downloadBytes } from './app/download'
import { showView } from './app/views'
import { Editor } from './editor/editor'
import { buildSignedPdf } from './export/exporter'
import { pageShell } from './pdf/renderer'
import { SignatureDialog } from './signature/dialog'

interface Session {
  document: OpenedDocument | null
  output: Uint8Array | null
}

const session: Session = { document: null, output: null }

const pdfInput = required<HTMLInputElement>('#pdf-input')
const landingError = required('[data-landing-error]')
const editorError = required('[data-editor-error]')

const editor = new Editor({
  pages: required('[data-pages]'),
  hint: required('[data-hint]'),
  hintText: required('[data-hint-text]'),
})

const signatureDialog = new SignatureDialog({
  dialog: required<HTMLDialogElement>('[data-signature-dialog]'),
  padCanvas: required<HTMLCanvasElement>('[data-pad]'),
  clearButton: required<HTMLButtonElement>('[data-action="clear-pad"]'),
  fileInput: required<HTMLInputElement>('[data-signature-input]'),
  uploadPreview: required<HTMLImageElement>('[data-upload-preview]'),
  error: required('[data-dialog-error]'),
  confirmButton: required<HTMLButtonElement>('[data-action="use-signature"]'),
  cancelButton: required<HTMLButtonElement>('[data-action="cancel-signature"]'),
  tabButtons: [...document.querySelectorAll<HTMLButtonElement>('[data-tab]')],
  panels: [...document.querySelectorAll<HTMLElement>('[data-panel]')],
})

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof DocumentError) return error.message
  console.error(error)
  return fallback
}

async function handleFile(file: File): Promise<void> {
  showMessage(landingError, '')
  try {
    const opened = await whileBusy('Opening your PDF…', () => openDocument(file))
    session.document = opened
    editor.mount(opened.pages)
    required('[data-file-name]').textContent = opened.name
    showMessage(editorError, '')
    showView('editor')
  } catch (error) {
    showView('landing')
    showMessage(landingError, errorMessage(error, 'Something went wrong while opening this PDF.'))
  }
}

async function addSignature(): Promise<void> {
  const signature = await signatureDialog.open()
  if (signature) editor.beginSignature(signature)
}

async function review(): Promise<void> {
  const opened = session.document
  if (!opened) return
  showMessage(editorError, '')
  try {
    const output = await whileBusy('Preparing your PDF…', () =>
      buildSignedPdf(opened.bytes, editor.frames(), editor.items()),
    )
    const pages = await whileBusy('Rendering preview…', () => renderBytes(output))
    session.output = output
    required('[data-preview-pages]').replaceChildren(...pages.map(pageShell))
    showView('preview')
  } catch (error) {
    showMessage(editorError, errorMessage(error, 'The signed PDF could not be created. Please try again.'))
  }
}

function downloadOutput(): void {
  if (!session.output || !session.document) return
  downloadBytes(session.output, signedFileName(session.document.name))
}

function approve(): void {
  downloadOutput()
  required('[data-done-file]').textContent = signedFileName(session.document?.name ?? 'document.pdf')
  showView('done')
}

function restart(): void {
  session.document = null
  session.output = null
  editor.reset()
  required('[data-preview-pages]').replaceChildren()
  pdfInput.value = ''
  showView('landing')
}

pdfInput.addEventListener('change', () => {
  const file = pdfInput.files?.[0]
  pdfInput.value = ''
  if (file) void handleFile(file)
})

onAction('add-text', () => editor.beginText())
onAction('add-signature', () => void addSignature())
onAction('cancel-placement', () => editor.cancelPlacement())
onAction('change-file', () => pdfInput.click())
onAction('review', () => void review())
onAction('back', () => showView('editor'))
onAction('approve', approve)
onAction('download-again', downloadOutput)
onAction('restart', restart)
