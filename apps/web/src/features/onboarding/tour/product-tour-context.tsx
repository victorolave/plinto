'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useProductTourController, type UseProductTourResult } from './use-product-tour'

const ProductTourContext = createContext<UseProductTourResult | null>(null)

/**
 * Owns the single driver.js instance shared by the whole dashboard shell.
 * Mount once, in `DashboardShell`, above the sidebar, bottom nav, and the
 * auto-start effect — every `useProductTour()` consumer below it shares the
 * same instance, so clicking the help button while the auto-start tour is
 * still running (or vice versa) can't spawn a second concurrent driver.js
 * overlay; `start()` on the shared instance is already a no-op while a run
 * is active (see use-product-tour.ts).
 */
export function ProductTourProvider({ children }: { children: ReactNode }) {
  const controller = useProductTourController()
  return (
    <ProductTourContext.Provider value={controller}>{children}</ProductTourContext.Provider>
  )
}

/**
 * Reads the shared product tour controller. Throws outside a
 * `ProductTourProvider` — every current caller (Sidebar, BottomNav,
 * ProductTourAutostart) renders under `DashboardShell`, which always
 * provides one, so hitting this means the provider was dropped somewhere,
 * not a legitimate optional-context case.
 */
export function useProductTour(): UseProductTourResult {
  const controller = useContext(ProductTourContext)
  if (!controller) {
    throw new Error('useProductTour must be used within a ProductTourProvider')
  }
  return controller
}
