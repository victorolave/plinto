'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useProductTour } from './product-tour-context'
import { useFirstStepsStatus } from '../../dashboard/components/first-steps-card'

/**
 * A brand-new household's first-steps queries are still on their skeleton
 * when this effect first runs (the shell finishes booting before the
 * card's own five queries settle) — waiting indefinitely for them would
 * risk never starting at all if the card fails to mount or its queries
 * never resolve, so this caps the wait.
 */
const FIRST_STEPS_FALLBACK_MS = 3000

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
  const firstStepsStatus = useFirstStepsStatus()
  // A ref, not state: guards the one-time start against React re-running
  // this effect (deps change, strict-mode double-invoke) without causing an
  // extra render.
  const startedRef = useRef(false)

  const shouldConsiderStarting =
    ready && pathname === '/dashboard' && !onboardingTourSeenAt

  useEffect(() => {
    if (startedRef.current || !shouldConsiderStarting) return

    // The first-steps card's own queries are usually still loading right
    // when the shell finishes booting — waiting for them means the
    // `firstSteps` tour step isn't filtered out on almost every real first
    // login (see tour-steps.ts's DOM-presence filter).
    if (firstStepsStatus !== 'loading') {
      startedRef.current = true
      start()
      return
    }

    const fallback = setTimeout(() => {
      if (startedRef.current) return
      startedRef.current = true
      start()
    }, FIRST_STEPS_FALLBACK_MS)

    return () => clearTimeout(fallback)
  }, [shouldConsiderStarting, firstStepsStatus, start])

  return null
}
