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

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
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

  if (response.status === 204) {
    return null as T
  }

  return (await response.json()) as T
}
