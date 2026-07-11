'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listAccounts } from '../../accounts/services/accounts'
import type { Account } from '../../accounts/services/accounts'
import {
  AccountBalance,
  Transaction,
  listBalances,
  listTransactions,
} from '../services/transactions'
import {
  RecurringTransactionRule,
  listRecurringTransactionRules,
} from '../services/recurring-transactions'
import { RecurringSection } from './recurring-section'
import { RecurringForm } from './recurring-form'
import { TransactionForm } from './transaction-form'
import { TransferForm } from './transfer-form'
import {
  BalanceStripSkeleton,
  TransactionListSkeleton,
} from './transactions-skeleton'
import { Category } from '../../categories/services/categories'
import { listCategories } from '../../categories/services/categories'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input, Select } from '../../../components/ui/field'
import { Amount } from '../../../components/ui/amount'
import { Badge } from '../../../components/ui/badge'
import { Tabs } from '../../../components/ui/tabs'
import { Drawer } from '../../../components/ui/drawer'
import { EmptyState } from '../../../components/ui/empty-state'
import {
  Briefcase,
  Cart,
  List,
  Filter,
  Pencil,
  Plus,
  Repeat,
  Search,
  Wallet,
  ArrowSwap,
} from '../../../components/ui/icons'
import {
  formatOccurredAtDate,
  isAutomaticRecurringTransaction,
} from '../lib/transaction-input'

// Re-exported for tests and existing consumers that import from this module.
export {
  formatOccurredAtDate,
  isAutomaticRecurringTransaction,
  buildTransactionCreateInput,
  buildTransactionUpdateInput,
} from '../lib/transaction-input'
export type {
  TransactionCreateInput,
  TransactionUpdateInput,
} from '../lib/transaction-input'

type HistoryFilter = 'all' | 'income' | 'expense'
type ActiveDrawer = 'transaction' | 'transfer' | 'recurring' | null
type DatePreset = 'all' | 'month' | '30d' | 'year' | 'custom'

const datePresetOptions: Array<{ value: DatePreset; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
]

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

export function TransactionsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<RecurringTransactionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')

  const [drawer, setDrawer] = useState<ActiveDrawer>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const router = useRouter()

  const loadData = async () => {
    const [balancesRes, transactionsRes] = await Promise.all([
      listBalances(),
      listTransactions(),
    ])
    setBalances(balancesRes.data.balances)
    setTransactions(transactionsRes.data.transactions)
  }

  const loadRecurring = async () => {
    const res = await listRecurringTransactionRules()
    setRules(res.data.rules)
  }

  useEffect(() => {
    const run = async () => {
      try {
        const [accountsRes, balancesRes, transactionsRes, categoriesRes, rulesRes] =
          await Promise.all([
            listAccounts(),
            listBalances(),
            listTransactions(),
            listCategories(),
            listRecurringTransactionRules(),
          ])
        setAccounts(accountsRes.data.accounts)
        setBalances(balancesRes.data.balances)
        setTransactions(transactionsRes.data.transactions)
        setCategories(categoriesRes.data.categories)
        setRules(rulesRes.data.rules)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transactions')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const closeDrawer = () => {
    setDrawer(null)
    setEditingTransaction(null)
  }

  const handleSaved = async () => {
    await loadData()
    closeDrawer()
  }

  const handleRecurringSaved = async () => {
    await loadRecurring()
    closeDrawer()
  }

  const openAdd = () => {
    setEditingTransaction(null)
    setDrawer('transaction')
  }

  const openEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setDrawer('transaction')
  }

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

  const incomeCount = transactions.filter((t) => t.type === 'income').length
  const expenseCount = transactions.filter((t) => t.type === 'expense').length

  return (
    <div className="page">
      {error ? <p className="error-text">{error}</p> : null}

      {/* Compact balances context */}
      {loading ? <BalanceStripSkeleton /> : null}
      {!loading && balances.length > 0 ? (
        <div className="balance-strip" aria-label="Account balances">
          {balances.map((balance) => (
            <div key={balance.accountId} className="balance-pill">
              <span className="balance-pill-name">{balance.accountName}</span>
              <Amount
                minor={balance.balanceMinor}
                currency={balance.currency}
                size="sm"
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* Toolbar: filter + on-demand entry points */}
      <div className="tx-toolbar">
        <Tabs
          items={[
            { id: 'all', label: 'All', count: transactions.length },
            { id: 'income', label: 'Income', count: incomeCount },
            { id: 'expense', label: 'Expenses', count: expenseCount },
          ]}
          value={historyFilter}
          onChange={setHistoryFilter}
        />
        <div className="tx-toolbar-actions">
          <Button
            variant="secondary"
            leftIcon={<ArrowSwap size={16} />}
            onClick={() => setDrawer('transfer')}
            disabled={accounts.length < 2}
          >
            Transfer
          </Button>
          <Button
            leftIcon={<Plus size={18} />}
            onClick={openAdd}
            disabled={accounts.length === 0}
          >
            Add transaction
          </Button>
        </div>
      </div>

      {/* Search + account filter (client-side over the loaded ledger) */}
      {!loading && transactions.length > 0 ? (
        <div className="tx-filters">
          <Input
            leftIcon={<Search size={16} />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by description or account"
            aria-label="Search transactions"
          />
          <Select
            className="tx-account-filter"
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            aria-label="Filter by account"
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </Select>

          <div className="tx-date-range">
            <Select
              className="tx-date-preset"
              value={datePreset}
              onChange={(event) => applyPreset(event.target.value as DatePreset)}
              aria-label="Date range preset"
            >
              {datePresetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              className="tx-date-input"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setCustomFrom(event.target.value)}
              aria-label="From date"
            />
            <span className="tx-date-sep">→</span>
            <Input
              type="date"
              className="tx-date-input"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setCustomTo(event.target.value)}
              aria-label="To date"
            />
          </div>
        </div>
      ) : null}

      {/* Transaction list — the focus of the view */}
      <Card flush>
        <div className="tx-list">
          {loading ? <TransactionListSkeleton /> : null}
          {!loading && accounts.length === 0 ? (
            <EmptyState
              compact
              icon={<Wallet size={26} />}
              title="No accounts yet"
              description="Add an account first — your transactions will show up here once you have somewhere to record them."
              action={
                <Button
                  variant="secondary"
                  leftIcon={<Plus size={16} />}
                  onClick={() => router.push('/dashboard/accounts')}
                >
                  Add account
                </Button>
              }
            />
          ) : null}
          {!loading && accounts.length > 0 && transactions.length === 0 ? (
            <EmptyState
              compact
              icon={<List size={26} />}
              title="No transactions yet"
              description="Record your first one to start building your household ledger."
              action={
                <Button leftIcon={<Plus size={16} />} onClick={openAdd}>
                  Add transaction
                </Button>
              }
            />
          ) : null}
          {!loading && transactions.length > 0 && visibleTransactions.length === 0 ? (
            <EmptyState
              compact
              icon={<Filter size={24} />}
              title="No matching transactions"
              description="Nothing matches your current search and filters."
              action={
                filtersActive ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : null}
          {visibleTransactions.map((transaction) => {
            const income = transaction.type === 'income'
            const RowIcon = income ? Briefcase : Cart
            const account = accountById.get(transaction.accountId)
            const automatic = isAutomaticRecurringTransaction(transaction)
            return (
              <div key={transaction.id} className="tx-row">
                <span className="tx-icon">
                  <RowIcon size={18} />
                </span>
                <div className="tx-main">
                  <div className="tx-title">
                    {transaction.description || (income ? 'Income' : 'Expense')}
                  </div>
                  <div className="tx-meta">
                    <span>{formatOccurredAtDate(transaction.occurredAt)}</span>
                    {account ? (
                      <>
                        <span>·</span>
                        <span>{account.name}</span>
                      </>
                    ) : null}
                    {automatic ? (
                      <Badge tone="info">
                        <Repeat size={11} /> Automatic
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="tx-right">
                  <Amount
                    minor={income ? transaction.amountMinor : -transaction.amountMinor}
                    currency={transaction.currency}
                    size="sm"
                    colorize
                    showSign
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Pencil size={15} />}
                    onClick={() => openEdit(transaction)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Recurring rules — visible on the main view, created on demand */}
      <RecurringSection
        rules={rules}
        accounts={accounts}
        loading={loading}
        onAdd={() => setDrawer('recurring')}
      />

      {/* On-demand transaction create / edit */}
      <Drawer
        open={drawer === 'transaction'}
        onClose={closeDrawer}
        title={editingTransaction ? 'Edit transaction' : 'Add transaction'}
        description="Logged to your household ledger"
      >
        <TransactionForm
          accounts={accounts}
          categories={categories}
          editing={editingTransaction}
          onSaved={handleSaved}
        />
      </Drawer>

      {/* On-demand transfer */}
      <Drawer
        open={drawer === 'transfer'}
        onClose={closeDrawer}
        title="Transfer between accounts"
        description="Move money with explicit FX when currencies differ"
      >
        <TransferForm accounts={accounts} onSaved={handleSaved} />
      </Drawer>

      {/* On-demand recurring rule creation */}
      <Drawer
        open={drawer === 'recurring'}
        onClose={closeDrawer}
        title="New recurring rule"
        description="Posts automatically each month when due"
      >
        <RecurringForm accounts={accounts} onSaved={handleRecurringSaved} />
      </Drawer>
    </div>
  )
}
