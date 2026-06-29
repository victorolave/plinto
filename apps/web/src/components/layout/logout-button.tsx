'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import { LogOut } from '../ui/icons'

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
    <Button
      variant="secondary"
      onClick={handleLogout}
      disabled={loading}
      leftIcon={<LogOut size={16} />}
    >
      {loading ? 'Logging out…' : 'Log out'}
    </Button>
  )
}
