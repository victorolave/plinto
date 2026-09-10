import { useEffect, useMemo, useState } from 'react'
import type { Account } from '../../accounts/services/accounts'
import type { TransactionFilters } from '../services/transactions'

export type HistoryFilter = 'all' | 'income' | 'expense'
export type DatePreset = 'all' | 'month' | '30d' | 'year' | 'custom'

/**
 * The order the date-range dropdown offers. Labels live in the catalogue under
 * `transactions.datePreset.*` — this hook is not a React component and has no
 * translator, so it must not carry the copy.
 */
export const DATE_PRESETS: DatePreset[] = ['all', 'month', '30d', 'year', 'custom']

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Resolve a preset to inclusive [from, to] YYYY-MM-DD bounds (empty = open). */
function presetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  switch (preset) {
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: toDateInputValue(from), to: toDateInputValue(to) }
    }
    case '30d': {
      const from = new Date(now)
      from.setDate(from.getDate() - 29)
      return { from: toDateInputValue(from), to: toDateInputValue(now) }
    }
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
    default:
      return { from: '', to: '' }
  }
}

/** How long the search field rests before it becomes a request. */
const SEARCH_SETTLE_MS = 300

/**
 * Follows `value`, but only after it has stopped changing for `delayMs`.
 *
 * Searching costs a database query now that filtering happens on the server.
 * Firing one per keystroke would put seven queries on the way for "mercado"
 * and let their answers race back out of order, so the field stays instant and
 * the request waits for the typing to settle.
 */
function useSettledValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return settled
}

export interface UseTransactionFiltersResult {
  historyFilter: HistoryFilter
  setHistoryFilter: (value: HistoryFilter) => void
  search: string
  setSearch: (value: string) => void
  accountFilter: string
  setAccountFilter: (value: string) => void
  dateFrom: string
  dateTo: string
  datePreset: DatePreset
  applyPreset: (preset: DatePreset) => void
  setCustomFrom: (value: string) => void
  setCustomTo: (value: string) => void
  accountById: Map<string, Account>
  /**
   * The narrowing to ask the API for. Absent keys mean "no filter"; the search
   * term here has settled, while `search` above tracks the field as it is
   * typed.
   */
  filters: TransactionFilters
  filtersActive: boolean
  clearFilters: () => void
}

/**
 * Owns the transactions-panel filter state (search / account / date range preset
 * or custom range) and shapes it into the query the API filters by.
 *
 * It used to filter an array of already-fetched rows. That is only honest while
 * the list is unpaginated: once there are pages, filtering what was fetched
 * searches one page and calls it the ledger. The state stayed here; the
 * filtering moved to the database.
 */
export function useTransactionFilters(accounts: Account[]): UseTransactionFiltersResult {
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')

  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  )

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset)
    if (preset !== 'custom') {
      const { from, to } = presetRange(preset)
      setDateFrom(from)
      setDateTo(to)
    }
  }

  const setCustomFrom = (value: string) => {
    setDateFrom(value)
    setDatePreset('custom')
  }
  const setCustomTo = (value: string) => {
    setDateTo(value)
    setDatePreset('custom')
  }

  const settledSearch = useSettledValue(search, SEARCH_SETTLE_MS)

  const filters = useMemo<TransactionFilters>(() => {
    // Only keys the reader actually set: an empty value would ask the API to
    // match emptiness instead of to skip the filter.
    const query: TransactionFilters = {}
    if (historyFilter !== 'all') query.type = historyFilter
    if (accountFilter) query.accountId = accountFilter
    if (dateFrom) query.dateFrom = dateFrom
    if (dateTo) query.dateTo = dateTo
    const term = settledSearch.trim()
    if (term) query.search = term
    return query
  }, [historyFilter, accountFilter, dateFrom, dateTo, settledSearch])

  const filtersActive =
    historyFilter !== 'all' ||
    accountFilter !== '' ||
    search.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== ''

  const clearFilters = () => {
    setHistoryFilter('all')
    setAccountFilter('')
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setDatePreset('all')
  }

  return {
    historyFilter,
    setHistoryFilter,
    search,
    setSearch,
    accountFilter,
    setAccountFilter,
    dateFrom,
    dateTo,
    datePreset,
    applyPreset,
    setCustomFrom,
    setCustomTo,
    accountById,
    filters,
    filtersActive,
    clearFilters,
  }
}
