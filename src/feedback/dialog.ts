import { showMessage } from '../app/dom'
import { sendFeedback, type FeedbackKind } from './client'

export interface FeedbackDialogElements {
  readonly dialog: HTMLDialogElement
  readonly form: HTMLFormElement
  readonly formView: HTMLElement
  readonly doneView: HTMLElement
  readonly messageLabel: HTMLElement
  readonly error: HTMLElement
  readonly submit: HTMLButtonElement
  readonly issueLink: HTMLAnchorElement
  readonly closeButtons: readonly HTMLButtonElement[]
}

const MESSAGE_LABELS: Record<FeedbackKind, string> = {
  problem: 'What went wrong?',
  suggestion: 'What would you like to see?',
}

export class FeedbackDialog {
  private readonly ui: FeedbackDialogElements
  private readonly endpoint: string

  constructor(ui: FeedbackDialogElements, endpoint: string) {
    this.ui = ui
    this.endpoint = endpoint
    ui.form.addEventListener('submit', (event) => {
      event.preventDefault()
      void this.submit()
    })
    ui.form.addEventListener('change', () => this.updateMessageLabel())
    ui.closeButtons.forEach((button) => button.addEventListener('click', () => ui.dialog.close()))
  }

  open(): void {
    this.showForm()
    this.ui.dialog.showModal()
  }

  private field(name: string): string {
    const value = new FormData(this.ui.form).get(name)
    return typeof value === 'string' ? value : ''
  }

  private kind(): FeedbackKind {
    return this.field('kind') === 'suggestion' ? 'suggestion' : 'problem'
  }

  private updateMessageLabel(): void {
    this.ui.messageLabel.textContent = MESSAGE_LABELS[this.kind()]
  }

  private showForm(): void {
    this.ui.formView.hidden = false
    this.ui.doneView.hidden = true
    showMessage(this.ui.error, '')
    this.updateMessageLabel()
  }

  private showDone(issueUrl: string | null): void {
    this.ui.form.reset()
    this.ui.formView.hidden = true
    this.ui.doneView.hidden = false
    this.ui.issueLink.hidden = !issueUrl
    if (issueUrl) this.ui.issueLink.href = issueUrl
  }

  private async submit(): Promise<void> {
    showMessage(this.ui.error, '')
    this.ui.submit.disabled = true
    try {
      const issueUrl = await sendFeedback(this.endpoint, {
        kind: this.kind(),
        message: this.field('message'),
        name: this.field('name'),
        website: this.field('website'),
      })
      this.showDone(issueUrl)
    } catch (error) {
      showMessage(this.ui.error, error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      this.ui.submit.disabled = false
    }
  }
}
