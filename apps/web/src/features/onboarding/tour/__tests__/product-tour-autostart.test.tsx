import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ProductTourAutostart } from '../product-tour-autostart'

const start = vi.fn()
let pathname = '/dashboard'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

vi.mock('../use-product-tour', () => ({
  useProductTour: () => ({ start, isRunning: false }),
}))

describe('ProductTourAutostart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pathname = '/dashboard'
  })

  it('starts the tour when the user has never seen it, on the dashboard route, once ready', () => {
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
