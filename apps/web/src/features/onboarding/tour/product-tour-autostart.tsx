'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useProductTour } from './use-product-tour'

export interface ProductTourAutostartProps {
  /** `null`/`undefined` when the user has never seen the tour yet. */
  onboardingTourSeenAt: string | null | undefined
  /** Whether the dashboard shell has finished bootstrapping `/me`. */
  ready: boolean
}

/**
 * Starts the guided tour automatically the first time a user reaches the
 * dashboard overview. "First login" is real across devices because it is
 * driven by `onboardingTourSeenAt` from the server (see the API's `/me`
 * payload), not a localStorage flag that would reset on a new browser.
 *
 * Renders nothing. Mount this once inside `DashboardShell`, after `/me` has
 * resolved, so it sees the real value rather than the pre-bootstrap default.
 */
export function ProductTourAutostart({ onboardingTourSeenAt, ready }: ProductTourAutostartProps) {
  const pathname = usePathname()
  const { start } = useProductTour()
  // A ref, not state: guards the one-time start against React re-running
  // this effect (deps change, strict-mode double-invoke) without causing an
  // extra render.
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    if (!ready) return
    if (pathname !== '/dashboard') return
    if (onboardingTourSeenAt) return

    startedRef.current = true
    start()
  }, [ready, pathname, onboardingTourSeenAt, start])

  return null
}
