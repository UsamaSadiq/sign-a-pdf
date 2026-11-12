import { buildIssue, parseFeedback, type IssueDraft } from './feedback'

interface Env {
  readonly GITHUB_TOKEN: string
  readonly GITHUB_REPO: string
  readonly ALLOWED_ORIGINS: string
  readonly FEEDBACK_LIMITER: RateLimit
}

const MAX_BODY_BYTES = 16_000

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin')
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim())
  return origin && allowed.includes(origin) ? origin : null
}

function json(status: number, body: unknown, origin: string | null): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
  }
  return new Response(JSON.stringify(body), { status, headers })
}

function preflight(origin: string | null): Response {
  if (!origin) return new Response(null, { status: 403 })
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  })
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function createIssue(draft: IssueDraft, env: Env): Promise<string | null> {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sign-a-pdf-feedback',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(draft),
  })
  if (!response.ok) {
    console.error('GitHub issue creation failed', response.status, await response.text())
    return null
  }
  const issue = (await response.json()) as { html_url?: string }
  return issue.html_url ?? null
}

async function handleFeedback(request: Request, env: Env, origin: string): Promise<Response> {
  const client = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const { success } = await env.FEEDBACK_LIMITER.limit({ key: client })
  if (!success) return json(429, { error: 'Too many messages. Please try again in a minute.' }, origin)
  const parsed = parseFeedback(await readJson(request))
  if (!parsed.ok) return parsed.spam ? json(200, { ok: true }, origin) : json(400, { error: parsed.error }, origin)
  const url = await createIssue(buildIssue(parsed.feedback), env)
  if (!url) return json(502, { error: 'Your message could not be posted right now. Please try again later.' }, origin)
  return json(201, { ok: true, url }, origin)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env)
    const { pathname } = new URL(request.url)
    if (!pathname.endsWith('/feedback')) return json(404, { error: 'Not found' }, origin)
    if (request.method === 'OPTIONS') return preflight(origin)
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, origin)
    if (!origin) return json(403, { error: 'Forbidden' }, null)
    return handleFeedback(request, env, origin)
  },
} satisfies ExportedHandler<Env>
