'use client'

import { useState } from 'react'

export function LogoutButton() {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Logout failed')
      }

      // Always redirect to login, even if there was an error
      // The cookie is cleared on the server side anyway
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect to login to ensure user is logged out from UI perspective
      window.location.href = '/login'
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="button secondary"
    >
      {loading ? 'Logging out...' : 'Log out'}
    </button>
  )
}
