/**
 * Session Manager
 * Handles automatic session refresh before JWT expiration
 */

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000 // Refresh 5 minutes before expiration
let refreshPromise: Promise<boolean> | null = null
let lastRefreshTime = 0
const MIN_REFRESH_INTERVAL_MS = 60 * 1000 // Don't refresh more than once per minute

/**
 * Attempts to refresh the session by calling the refresh endpoint
 * Returns true if successful, false otherwise
 */
export async function refreshSessionIfNeeded(): Promise<boolean> {
  // Prevent concurrent refresh attempts
  if (refreshPromise) {
    return refreshPromise
  }

  // Rate limit: don't refresh too frequently
  const now = Date.now()
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL_MS) {
    return true // Assume still valid if we just refreshed
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        lastRefreshTime = Date.now()
        return true
      }

      // Refresh failed, session is invalid
      if (response.status === 401) {
        // Force logout by redirecting to login
        window.location.href = '/login'
        return false
      }

      return false
    } catch (error) {
      console.error('[Session Manager] Refresh failed:', error)
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * Sets up automatic session refresh on a timer
 * Refreshes the session periodically to keep it alive
 */
export function setupAutoRefresh() {
  // Refresh every 20 minutes (JWT expires in 30 minutes)
  const REFRESH_INTERVAL_MS = 20 * 60 * 1000

  const intervalId = setInterval(() => {
    refreshSessionIfNeeded().catch((error) => {
      console.error('[Session Manager] Auto-refresh error:', error)
    })
  }, REFRESH_INTERVAL_MS)

  // Also refresh when page becomes visible (user returns to tab)
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      refreshSessionIfNeeded().catch((error) => {
        console.error('[Session Manager] Visibility refresh error:', error)
      })
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Cleanup function
  return () => {
    clearInterval(intervalId)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

