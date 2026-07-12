'use client'

import { createContext, useContext } from 'react'
import type { TenantOption } from './tenant-switcher'

export interface DashboardUser {
  name: string
  email?: string
}

export interface DashboardContextValue {
  /** Display name of the currently active household (empty until resolved). */
  activeTenantName: string
  /** Households the current user belongs to, for the tenant switcher. */
  tenants: TenantOption[]
  activeTenantId: string | null
  onSelectTenant: (tenantId: string) => void
  user: DashboardUser
  onLogout: () => void
  loggingOut: boolean
}

const DashboardContext = createContext<DashboardContextValue>({
  activeTenantName: '',
  tenants: [],
  activeTenantId: null,
  onSelectTenant: () => {},
  user: { name: '' },
  onLogout: () => {},
  loggingOut: false,
})

export const DashboardProvider = DashboardContext.Provider

export function useDashboard(): DashboardContextValue {
  return useContext(DashboardContext)
}
