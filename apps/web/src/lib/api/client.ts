/**
 * API client. Sessions are kept alive server-side via sliding expiration, so a
 * 401 means the session genuinely ended (idle timeout or absolute cap) — send
 * the user back to login rather than attempting a refresh.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<any> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'

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
    const error = await response.json().catch(() => ({ error: { message: 'Unauthorized' } }))
    throw new Error(error?.error?.message ?? 'Unauthorized')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
    throw new Error(error?.error?.message ?? 'Request failed')
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}
