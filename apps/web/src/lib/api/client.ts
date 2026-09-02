import { ApiError } from './api-error'

/**
 * API client. Sessions are kept alive server-side via sliding expiration, so a
 * 401 means the session genuinely ended (idle timeout or absolute cap) — send
 * the user back to login rather than attempting a refresh.
 */

interface ErrorEnvelope {
  error?: {
    code?: string
    message?: string
    details?: unknown
    traceId?: string
  }
}

/**
 * Turns the API's `{ error: { code, message, … } }` envelope into an `ApiError`
 * that keeps the code. The code is what gets translated; the message is only
 * the fallback for a code the UI has no wording for yet.
 */
async function toApiError(response: Response, fallbackCode: string): Promise<ApiError> {
  const body: ErrorEnvelope = await response.json().catch(() => ({}))

  return new ApiError({
    code: body.error?.code ?? fallbackCode,
    message: body.error?.message ?? fallbackCode,
    status: response.status,
    details: body.error?.details,
    traceId: body.error?.traceId,
  })
}

/**
 * Shared plumbing behind `apiFetch` and `apiFetchBlob`: base URL, headers,
 * credentials, the 401→login redirect and the error-envelope translation.
 * The two callers diverge only in how they read a *successful* body (JSON
 * object vs. Blob), which is why that part is not in here.
 */
async function request(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api'

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  })

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw await toApiError(response, 'UNAUTHORIZED')
  }

  if (!response.ok) {
    throw await toApiError(response, 'REQUEST_FAILED')
  }

  return response
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init)

  if (response.status === 204) {
    return null as T
  }

  return (await response.json()) as T
}

/**
 * Extracts the filename an attachment response wants saved as, from its
 * `Content-Disposition` header. Prefers the RFC 5987 `filename*` form (which
 * carries percent-encoded UTF-8, e.g. for an accented tenant name) over the
 * plain `filename="..."` form, matching how browsers themselves resolve the
 * two when both are present.
 */
export function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null

  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim())
    } catch {
      return extended[1].trim()
    }
  }

  const simple = /filename\s*=\s*"?([^";]+)"?/.exec(header)
  return simple?.[1]?.trim() ?? null
}

/**
 * Like `apiFetch`, but for endpoints that respond with a file rather than a
 * JSON envelope (the household/transactions export downloads). Shares every
 * other concern — base URL, credentials, the 401 redirect, error decoding —
 * with `apiFetch` via `request`.
 */
export async function apiFetchBlob(
  path: string,
  init?: RequestInit,
): Promise<{ blob: Blob; filename: string | null }> {
  const response = await request(path, init)
  const blob = await response.blob()
  const filename = parseContentDispositionFilename(response.headers.get('Content-Disposition'))

  return { blob, filename }
}
