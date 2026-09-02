import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { ProductTourAutostart } from '../product-tour-autostart'

const start = vi.fn()
let pathname = '/dashboard'
let firstStepsStatus: 'loading' | 'visible' | 'hidden' = 'visible'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

vi.mock('../product-tour-context', () => ({
  useProductTour: () => ({ start, isRunning: false }),
}))

vi.mock('../../../dashboard/components/first-steps-card', () => ({
  useFirstStepsStatus: () => firstStepsStatus,
}))

describe('ProductTourAutostart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pathname = '/dashboard'
    firstStepsStatus = 'visible'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts the tour when the user has never seen it, on the dashboard route, once ready and the checklist has settled', () => {
    render(<ProductTourAutostart onboardingTourSeenAt={null} ready />)

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('does not start while the shell has not finished loading', () => {
    render(<ProductTourAutostart onboardingTourSeenAt={null} ready={false} />)

    expect(start).not.toHaveBeenCalled()
  })

  it('does not start when the user has already seen the tour', () => {
    render(<ProductTourAutostart onboardingTourSeenAt="2026-01-01T00:00:00.000Z" ready />)

    expect(start).not.toHaveBeenCalled()
  })

  it('does not start outside the dashboard overview route', () => {
    pathname = '/dashboard/accounts'
    render(<ProductTourAutostart onboardingTourSeenAt={null} ready />)

    expect(start).not.toHaveBeenCalled()
  })

  it('does not start while the first-steps checklist is still loading', () => {
    firstStepsStatus = 'loading'
    render(<ProductTourAutostart onboardingTourSeenAt={null} ready />)

    expect(start).not.toHaveBeenCalled()
  })

  it('starts once the checklist becomes visible', () => {
    firstStepsStatus = 'loading'
    const { rerender } = render(<ProductTourAutostart onboardingTourSeenAt={null} ready />)
    expect(start).not.toHaveBeenCalled()

    firstStepsStatus = 'visible'
    rerender(<ProductTourAutostart onboardingTourSeenAt={null} ready />)

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('starts once the checklist resolves to hidden (dismissed/errored/all done)', () => {
    firstStepsStatus = 'loading'
    const { rerender } = render(<ProductTourAutostart onboardingTourSeenAt={null} ready />)
    expect(start).not.toHaveBeenCalled()

    firstStepsStatus = 'hidden'
    rerender(<ProductTourAutostart onboardingTourSeenAt={null} ready />)

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('starts after a fallback timeout even if the checklist never resolves, so the tour never gets stuck', () => {
    vi.useFakeTimers()
    firstStepsStatus = 'loading'
    render(<ProductTourAutostart onboardingTourSeenAt={null} ready />)
    expect(start).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('does not fire the fallback timeout once the checklist already resolved', () => {
    vi.useFakeTimers()
    render(<ProductTourAutostart onboardingTourSeenAt={null} ready />)
    expect(start).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('never starts twice, even if props change after the first start', () => {
    const { rerender } = render(<ProductTourAutostart onboardingTourSeenAt={null} ready />)
    expect(start).toHaveBeenCalledTimes(1)

    rerender(<ProductTourAutostart onboardingTourSeenAt={null} ready />)

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('renders nothing', () => {
    const { container } = render(<ProductTourAutostart onboardingTourSeenAt={null} ready />)
    expect(container).toBeEmptyDOMElement()
  })
})
