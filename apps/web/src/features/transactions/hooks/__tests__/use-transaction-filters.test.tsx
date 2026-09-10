import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransactionFilters } from '../use-transaction-filters'
import type { Account } from '../../../accounts/services/accounts'

const accounts = [
  { id: 'account-1', name: 'Ahorros', type: 'savings', currency: 'COP' },
] as unknown as Account[]

/**
 * The hook used to filter an array in the browser. It now only produces the
 * query the server filters by, so these assertions are about the shape of that
 * query: what it omits matters as much as what it carries, because a key with
 * an empty value would ask the API to match emptiness rather than to skip the
 * filter.
 */
describe('useTransactionFilters', () => {
  it('starts with no narrowing at all', () => {
    const { result } = renderHook(() => useTransactionFilters(accounts))

    expect(result.current.filters).toEqual({})
    expect(result.current.filtersActive).toBe(false)
  })

  it('reads the "all" history filter as no type filter', () => {
    const { result } = renderHook(() => useTransactionFilters(accounts))

    act(() => result.current.setHistoryFilter('all'))

    expect(result.current.filters.type).toBeUndefined()
  })

  it.each(['income', 'expense'] as const)('carries the %s history filter as a type', (type) => {
    const { result } = renderHook(() => useTransactionFilters(accounts))

    act(() => result.current.setHistoryFilter(type))

    expect(result.current.filters.type).toBe(type)
    expect(result.current.filtersActive).toBe(true)
  })

  it('omits the account filter when no account is chosen', () => {
    const { result } = renderHook(() => useTransactionFilters(accounts))

    act(() => result.current.setAccountFilter(''))

    expect(result.current.filters.accountId).toBeUndefined()
  })

  it('carries a chosen account', () => {
    const { result } = renderHook(() => useTransactionFilters(accounts))

    act(() => result.current.setAccountFilter('account-1'))

    expect(result.current.filters.accountId).toBe('account-1')
  })

  it('turns a date preset into an explicit range', () => {
    const { result } = renderHook(() => useTransactionFilters(accounts))

    act(() => result.current.applyPreset('year'))

    const year = new Date().getFullYear()
    expect(result.current.filters.dateFrom).toBe(`${year}-01-01`)
    expect(result.current.filters.dateTo).toBe(`${year}-12-31`)
  })

  it('reads the "all" preset as an open range', () => {
    const { result } = renderHook(() => useTransactionFilters(accounts))

    act(() => result.current.applyPreset('year'))
    act(() => result.current.applyPreset('all'))

    expect(result.current.filters.dateFrom).toBeUndefined()
    expect(result.current.filters.dateTo).toBeUndefined()
  })

  it('clears every filter at once', () => {
    const { result } = renderHook(() => useTransactionFilters(accounts))

    act(() => {
      result.current.setHistoryFilter('expense')
      result.current.setAccountFilter('account-1')
      result.current.applyPreset('month')
    })
    act(() => result.current.clearFilters())

    expect(result.current.filters).toEqual({})
    expect(result.current.filtersActive).toBe(false)
  })

  it('still exposes the accounts by id, for rendering a row', () => {
    const { result } = renderHook(() => useTransactionFilters(accounts))

    expect(result.current.accountById.get('account-1')?.name).toBe('Ahorros')
  })

  describe('search', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    /**
     * Searching now costs a request. Sending one per keystroke would put a
     * query on the database for every letter of "mercado" and race the answers
     * back out of order, so the field updates immediately and the query waits.
     */
    it('does not query on every keystroke', () => {
      const { result } = renderHook(() => useTransactionFilters(accounts))

      act(() => result.current.setSearch('mer'))

      expect(result.current.search).toBe('mer')
      expect(result.current.filters.search).toBeUndefined()
    })

    it('queries once the typing settles', () => {
      const { result } = renderHook(() => useTransactionFilters(accounts))

      act(() => result.current.setSearch('mercado'))
      act(() => vi.advanceTimersByTime(400))

      expect(result.current.filters.search).toBe('mercado')
    })

    it('reads a whitespace-only search as no search', () => {
      const { result } = renderHook(() => useTransactionFilters(accounts))

      act(() => result.current.setSearch('   '))
      act(() => vi.advanceTimersByTime(400))

      expect(result.current.filters.search).toBeUndefined()
    })

    it('trims the settled term', () => {
      const { result } = renderHook(() => useTransactionFilters(accounts))

      act(() => result.current.setSearch('  mercado  '))
      act(() => vi.advanceTimersByTime(400))

      expect(result.current.filters.search).toBe('mercado')
    })
  })
})
