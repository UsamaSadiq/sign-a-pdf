export type FeedbackKind = 'problem' | 'suggestion'

export interface Feedback {
  readonly kind: FeedbackKind
  readonly message: string
  readonly name: string | null
}

export type ParseResult =
  | { readonly ok: true; readonly feedback: Feedback }
  | { readonly ok: false; readonly spam: boolean; readonly error: string }

export interface IssueDraft {
  readonly title: string
  readonly body: string
  readonly labels: readonly string[]
}

const MIN_MESSAGE = 10
const MAX_MESSAGE = 3000
const MAX_NAME = 80
const TITLE_SUMMARY = 70

const KIND_DETAILS: Record<FeedbackKind, { readonly label: string; readonly githubLabel: string }> = {
  problem: { label: 'Problem', githubLabel: 'bug' },
  suggestion: { label: 'Suggestion', githubLabel: 'enhancement' },
}

const reject = (error: string, spam = false): ParseResult => ({ ok: false, spam, error })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isKind(value: unknown): value is FeedbackKind {
  return value === 'problem' || value === 'suggestion'
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : ''
}

export function parseFeedback(input: unknown): ParseResult {
  if (!isRecord(input)) return reject('Invalid request.')
  if (cleanText(input.website)) return reject('Rejected.', true)
  if (!isKind(input.kind)) return reject('Choose whether this is a problem or a suggestion.')
  const message = cleanText(input.message)
  if (message.length < MIN_MESSAGE) return reject(`Please write at least ${MIN_MESSAGE} characters.`)
  if (message.length > MAX_MESSAGE) return reject(`Please keep it under ${MAX_MESSAGE} characters.`)
  const name = cleanText(input.name).slice(0, MAX_NAME)
  return { ok: true, feedback: { kind: input.kind, message, name: name || null } }
}

function neutralizeMentions(text: string): string {
  return text.replace(/@/g, '@​')
}

function quote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n')
}

function summary(message: string): string {
  const firstLine = message.split(/\r?\n/, 1)[0]
  return firstLine.length > TITLE_SUMMARY ? `${firstLine.slice(0, TITLE_SUMMARY - 1)}…` : firstLine
}

export function buildIssue(feedback: Feedback): IssueDraft {
  const details = KIND_DETAILS[feedback.kind]
  const message = neutralizeMentions(feedback.message)
  const author = feedback.name ? neutralizeMentions(feedback.name) : 'Anonymous'
  return {
    title: `${details.label}: ${summary(message)}`,
    body: [
      `**Type:** ${details.label}`,
      `**From:** ${author}`,
      '',
      quote(message),
      '',
      '---',
      '_Submitted from the feedback form on [Sign a PDF](https://usamasadiq.us/sign-a-pdf/)._',
    ].join('\n'),
    labels: ['user feedback', details.githubLabel],
  }
}
