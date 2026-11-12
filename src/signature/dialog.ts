import type { Signature } from '../editor/model'
import { signatureFromCanvas, signatureFromFile } from './image'
import { SignaturePad } from './pad'

type Tab = 'draw' | 'upload'

export interface SignatureDialogElements {
  readonly dialog: HTMLDialogElement
  readonly padCanvas: HTMLCanvasElement
  readonly clearButton: HTMLButtonElement
  readonly fileInput: HTMLInputElement
  readonly uploadPreview: HTMLImageElement
  readonly error: HTMLElement
  readonly confirmButton: HTMLButtonElement
  readonly cancelButton: HTMLButtonElement
  readonly tabButtons: readonly HTMLButtonElement[]
  readonly panels: readonly HTMLElement[]
}

export class SignatureDialog {
  private readonly pad: SignaturePad
  private tab: Tab = 'draw'
  private uploaded: Signature | null = null
  private settle: ((signature: Signature | null) => void) | null = null

  private readonly ui: SignatureDialogElements

  constructor(ui: SignatureDialogElements) {
    this.ui = ui
    this.pad = new SignaturePad(ui.padCanvas)
    ui.clearButton.addEventListener('click', () => this.pad.clear())
    ui.fileInput.addEventListener('change', () => this.handleUpload())
    ui.confirmButton.addEventListener('click', () => this.confirm())
    ui.cancelButton.addEventListener('click', () => this.finish(null))
    ui.dialog.addEventListener('cancel', () => this.finish(null))
    ui.tabButtons.forEach((button) =>
      button.addEventListener('click', () => this.selectTab(button.dataset.tab as Tab)),
    )
  }

  open(): Promise<Signature | null> {
    this.showError('')
    this.ui.dialog.showModal()
    this.selectTab(this.tab)
    return new Promise((resolve) => {
      this.settle = resolve
    })
  }

  private selectTab(tab: Tab): void {
    this.tab = tab
    this.ui.tabButtons.forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === tab)))
    this.ui.panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab
    })
    if (tab === 'draw') this.pad.resize()
  }

  private async handleUpload(): Promise<void> {
    const file = this.ui.fileInput.files?.[0]
    this.ui.fileInput.value = ''
    if (!file) return
    try {
      this.uploaded = await signatureFromFile(file)
      this.showError(this.uploaded ? '' : 'No signature found in that image.')
      this.ui.uploadPreview.hidden = !this.uploaded
      if (this.uploaded) this.ui.uploadPreview.src = this.uploaded.url
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'That image could not be used.')
    }
  }

  private async confirm(): Promise<void> {
    const signature = this.tab === 'draw' ? await this.drawnSignature() : this.uploaded
    if (!signature) {
      this.showError(this.tab === 'draw' ? 'Draw your signature first.' : 'Choose a signature image first.')
      return
    }
    this.finish(signature)
  }

  private drawnSignature(): Promise<Signature | null> {
    if (this.pad.isEmpty()) return Promise.resolve(null)
    return signatureFromCanvas(this.pad.element)
  }

  private showError(message: string): void {
    this.ui.error.textContent = message
    this.ui.error.hidden = !message
  }

  private finish(signature: Signature | null): void {
    if (this.ui.dialog.open) this.ui.dialog.close()
    this.settle?.(signature)
    this.settle = null
  }
}
