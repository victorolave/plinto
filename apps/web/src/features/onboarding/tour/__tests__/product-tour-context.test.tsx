import { describe, expect, it, vi } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import { ProductTourProvider, useProductTour } from '../product-tour-context'

vi.mock('../use-product-tour', () => ({
  useProductTourController: () => ({ start: vi.fn(), isRunning: false }),
}))

describe('useProductTour (context)', () => {
  it('throws when used outside a ProductTourProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useProductTour())).toThrow(/ProductTourProvider/)

    consoleError.mockRestore()
  })

  it('returns the same controller instance to every consumer under one provider', () => {
    let first: unknown
    let second: unknown

    function ConsumerA() {
      first = useProductTour()
      return null
    }
    function ConsumerB() {
      second = useProductTour()
      return null
    }

    render(
      <ProductTourProvider>
        <ConsumerA />
        <ConsumerB />
      </ProductTourProvider>,
    )

    expect(first).toBeDefined()
    expect(first).toBe(second)
  })
})
