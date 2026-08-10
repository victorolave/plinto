import { useMemo, useState } from 'react'
import type { Account } from '../../accounts/services/accounts'
import type { Transaction } from '../services/transactions'

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
  visibleTransactions: Transaction[]
  filtersActive: boolean
  clearFilters: () => void
}

/**
 * Owns the transactions-panel filter state (search / account / date range preset or
 * custom range) and derives the client-side filtered `visibleTransactions` list.
 */
export function useTransactionFilters(
  transactions: Transaction[],
  accounts: Account[],
): UseTransactionFiltersResult {
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

  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()
    return transactions.filter((transaction) => {
      if (historyFilter !== 'all' && transaction.type !== historyFilter) return false
      if (accountFilter && transaction.accountId !== accountFilter) return false
      // occurredAt is a UTC instant; its date slice matches how the row renders.
      const occurredDate = transaction.occurredAt.slice(0, 10)
      if (dateFrom && occurredDate < dateFrom) return false
      if (dateTo && occurredDate > dateTo) return false
      if (query) {
        const account = accountById.get(transaction.accountId)
        const haystack =
          `${transaction.description ?? ''} ${account?.name ?? ''}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [transactions, historyFilter, accountFilter, search, dateFrom, dateTo, accountById])

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
    visibleTransactions,
    filtersActive,
    clearFilters,
  }
}
