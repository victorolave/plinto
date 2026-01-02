'use client'

import { useEffect } from 'react'
import { setupAutoRefresh } from '../../lib/auth/session-manager'

/**
 * SessionProvider component
 * Sets up automatic session refresh for the entire application
 * Should be used at the root level of the app
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Set up automatic session refresh
    const cleanup = setupAutoRefresh()

    // Cleanup on unmount
    return cleanup
  }, [])

  return <>{children}</>
}

