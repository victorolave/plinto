'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/api/client'
import { setupAutoRefresh } from '../../../lib/auth/session-manager'

export function useAuthBootstrap() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Set up automatic session refresh
    const cleanup = setupAutoRefresh()

    const run = async () => {
      try {
        const response = await apiFetch('/me')
        const activeTenantId = response?.data?.activeTenantId
        if (!activeTenantId) {
          window.location.href = '/select-tenant'
          return
        }
        setLoading(false)
      } catch (err) {
        window.location.href = '/login'
      }
    }

    void run()

    // Cleanup on unmount
    return cleanup
  }, [])

  return { loading }
}
