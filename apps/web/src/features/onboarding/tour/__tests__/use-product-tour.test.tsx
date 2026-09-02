import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { driver } from 'driver.js'
import { useProductTourController } from '../use-product-tour'
import { markTourSeen } from '../onboarding-tour.service'
import { queryKeys } from '../../../../lib/api/query-keys'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const drive = vi.fn()
const destroy = vi.fn()
const isActive = vi.fn(() => false)

vi.mock('driver.js', () => ({
  driver: vi.fn(() => ({ drive, destroy, isActive })),
}))

vi.mock('../onboarding-tour.service', () => ({
  markTourSeen: vi.fn(),
}))

const mockedDriver = vi.mocked(driver)
const mockedMarkTourSeen = vi.mocked(markTourSeen)

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

/** Config object passed to the mocked `driver()` on its most recent call. */
function lastDriverConfig() {
  const calls = mockedDriver.mock.calls
  return calls[calls.length - 1][0] as { onDestroyed?: () => void }
}

describe('useProductTour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isActive.mockReturnValue(false)
    mockedMarkTourSeen.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
      onboardingTourSeenAt: '2026-01-02T00:00:00.000Z',
    })
  })

  it('drives the tour when start is called', () => {
    const { result } = renderHook(() => useProductTourController(), {
      wrapper: wrapperFor(new QueryClient()),
    })

    act(() => {
      result.current.start()
    })

    expect(drive).toHaveBeenCalledTimes(1)
  })

  it('does not start a second instance while one is already active', () => {
    isActive.mockReturnValue(true)
    const { result } = renderHook(() => useProductTourController(), {
      wrapper: wrapperFor(new QueryClient()),
    })

    act(() => {
      result.current.start()
      result.current.start()
    })

    // driver() itself is only called once because the guard checks
    // `driverRef.current?.isActive()` before creating a new instance.
    expect(mockedDriver).toHaveBeenCalledTimes(1)
  })

  it('marks the tour seen exactly once per run when destroyed', async () => {
    const { result } = renderHook(() => useProductTourController(), {
      wrapper: wrapperFor(new QueryClient()),
    })

    act(() => {
      result.current.start()
    })

    await act(async () => {
      const config = lastDriverConfig()
      config.onDestroyed?.()
      config.onDestroyed?.() // a second destroy in the same run must not re-mark
      await Promise.resolve()
    })

    expect(mockedMarkTourSeen).toHaveBeenCalledTimes(1)
  })

  it('marks the tour seen again on a subsequent run', async () => {
    const { result } = renderHook(() => useProductTourController(), {
      wrapper: wrapperFor(new QueryClient()),
    })

    act(() => {
      result.current.start()
    })
    await act(async () => {
      lastDriverConfig().onDestroyed?.()
      await Promise.resolve()
    })

    isActive.mockReturnValue(false)
    act(() => {
      result.current.start()
    })
    await act(async () => {
      lastDriverConfig().onDestroyed?.()
      await Promise.resolve()
    })

    expect(mockedMarkTourSeen).toHaveBeenCalledTimes(2)
  })

  it('optimistically patches the cached /me user with the new timestamp', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(queryKeys.me, {
      data: { user: { name: 'Alice', onboardingTourSeenAt: null } },
    })
    const { result } = renderHook(() => useProductTourController(), {
      wrapper: wrapperFor(queryClient),
    })

    act(() => {
      result.current.start()
    })
    await act(async () => {
      lastDriverConfig().onDestroyed?.()
      await Promise.resolve()
    })

    expect(queryClient.getQueryData(queryKeys.me)).toEqual({
      data: { user: { name: 'Alice', onboardingTourSeenAt: '2026-01-02T00:00:00.000Z' } },
    })
  })

  it('destroys the driver instance on unmount', () => {
    isActive.mockReturnValue(true)
    const { result, unmount } = renderHook(() => useProductTourController(), {
      wrapper: wrapperFor(new QueryClient()),
    })

    act(() => {
      result.current.start()
    })

    unmount()

    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
