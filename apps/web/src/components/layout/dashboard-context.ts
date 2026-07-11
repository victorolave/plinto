'use client'

import { createContext, useContext } from 'react'

export interface DashboardContextValue {
  /** Display name of the currently active household (empty until resolved). */
  activeTenantName: string
}

const DashboardContext = createContext<DashboardContextValue>({
  activeTenantName: '',
})

export const DashboardProvider = DashboardContext.Provider

export function useDashboard(): DashboardContextValue {
  return useContext(DashboardContext)
}
