import { refreshSessionIfNeeded } from '../auth/session-manager'

/**
 * Enhanced API client with automatic session refresh on 401 errors
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<any> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'
  
  // Make the initial request
  let response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  })

  // If we get a 401, try to refresh the session and retry once
  if (response.status === 401) {
    const refreshed = await refreshSessionIfNeeded()
    
    if (refreshed) {
      // Retry the request with the refreshed session
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
        credentials: 'include',
      })
    } else {
      // Refresh failed, redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      const error = await response.json().catch(() => ({ error: { message: 'Unauthorized' } }))
      throw new Error(error?.error?.message ?? 'Unauthorized')
    }
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
