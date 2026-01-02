'use client'

import type { ReactNode } from 'react'
import { useAuthBootstrap } from '../../features/auth/hooks/use-auth-bootstrap'
import { LogoutButton } from '../../components/layout/logout-button'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { loading } = useAuthBootstrap()

  if (loading) {
    return <div className="page-shell">Loading...</div>
  }

  return (
    <div>
      <header className="app-header">
        <a href="/select-tenant" className="link">
          Switch tenant
        </a>
        <LogoutButton />
      </header>
      <div className="page-shell">{children}</div>
    </div>
  )
}
