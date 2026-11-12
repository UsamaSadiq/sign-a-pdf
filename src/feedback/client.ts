export type FeedbackKind = 'problem' | 'suggestion'

export interface FeedbackPayload {
  readonly kind: FeedbackKind
  readonly message: string
  readonly name: string
  readonly website: string
}

const FALLBACK_ERROR = 'Your message could not be sent right now. Please try again later.'

export function feedbackEndpoint(): string | null {
  const url = import.meta.env.VITE_FEEDBACK_URL
  return typeof url === 'string' && url ? url : null
}

async function errorFrom(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : FALLBACK_ERROR
  } catch {
    return FALLBACK_ERROR
  }
}

export async function sendFeedback(endpoint: string, payload: FeedbackPayload): Promise<string | null> {
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('Could not reach the feedback service. Check your connection and try again.')
  }
  if (!response.ok) throw new Error(await errorFrom(response))
  const body = (await response.json()) as { url?: unknown }
  return typeof body.url === 'string' ? body.url : null
}
