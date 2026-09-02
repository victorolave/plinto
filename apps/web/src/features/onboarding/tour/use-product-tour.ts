'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '../../../styles/tour.css'
import { queryKeys } from '../../../lib/api/query-keys'
import { buildTourSteps } from './tour-steps'
import { markTourSeen } from './onboarding-tour.service'

/**
 * Mirrors the CSS breakpoint at which the sidebar collapses into the bottom
 * nav (see globals.css `@media (max-width: 900px)`) — the tour needs the
 * same cutoff to pick mobile vs. desktop anchors (see tour-steps.ts).
 */
const MOBILE_BREAKPOINT_QUERY = '(max-width: 900px)'

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY)
    setIsMobile(mql.matches)

    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

/** Shape of the cached `/me` response this hook patches optimistically. */
interface MeCache {
  data?: {
    user?: Record<string, unknown>
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface UseProductTourResult {
  start: () => void
  isRunning: boolean
}

/**
 * Owns one driver.js instance per consumer. `start()` (re)builds the step
 * list from the current DOM/viewport and drives it; the instance is
 * destroyed on unmount so it never survives the component going away
 * mid-tour.
 *
 * Every time the tour ends — finished, closed early, or torn down by
 * unmount — it is marked seen on the server exactly once per run (see
 * `markTourSeen`), and the cached `/me` response is patched optimistically
 * so nothing needs a refetch before it stops looking like a first login.
 */
export function useProductTour(): UseProductTourResult {
  const t = useTranslations('tour')
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const driverRef = useRef<Driver | null>(null)
  const seenRef = useRef(false)
  const [isRunning, setIsRunning] = useState(false)

  const start = useCallback(() => {
    if (driverRef.current?.isActive()) return

    const steps = buildTourSteps(t, { isMobile })
    if (steps.length === 0) return

    seenRef.current = false

    const instance = driver({
      showProgress: true,
      allowClose: true,
      nextBtnText: t('buttons.next'),
      prevBtnText: t('buttons.prev'),
      doneBtnText: t('buttons.done'),
      steps,
      onDestroyed: () => {
        setIsRunning(false)
        if (seenRef.current) return
        seenRef.current = true

        void markTourSeen()
          .then((user) => {
            queryClient.setQueryData(queryKeys.me, (previous: MeCache | undefined) => {
              if (!previous?.data) return previous
              return {
                ...previous,
                data: {
                  ...previous.data,
                  user: {
                    ...previous.data.user,
                    onboardingTourSeenAt: user.onboardingTourSeenAt,
                  },
                },
              }
            })
          })
          .catch(() => {
            // Best-effort: if this write fails the tour may auto-start
            // again next session — annoying, but never unsafe.
          })
      },
    })

    driverRef.current = instance
    setIsRunning(true)
    instance.drive()
  }, [t, isMobile, queryClient])

  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
      driverRef.current = null
    }
  }, [])

  return { start, isRunning }
}
