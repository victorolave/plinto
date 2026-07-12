'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listAccounts } from '../../accounts/services/accounts'
import { Transaction, listBalances, listTransactions } from '../services/transactions'
import {
  RecurringTransactionRule,
  listRecurringTransactionRules,
} from '../services/recurring-transactions'
import { queryKeys } from '../../../lib/api/query-keys'
import { RecurringSection } from './recurring-section'
import { RecurringForm } from './recurring-form'
import { TransactionForm } from './transaction-form'
import { TransactionList } from './transaction-list'
import { TransferForm } from './transfer-form'
import { BalanceStripSkeleton } from './transactions-skeleton'
import { listCategories } from '../../categories/services/categories'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input, Select } from '../../../components/ui/field'
import { Amount } from '../../../components/ui/amount'
import { Tabs } from '../../../components/ui/tabs'
import { Drawer } from '../../../components/ui/drawer'
import { ArrowSwap, Plus, Search } from '../../../components/ui/icons'
import { useTransactionFilters, datePresetOptions } from '../hooks/use-transaction-filters'
import type { DatePreset } from '../hooks/use-transaction-filters'
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

type ActiveDrawer = 'transaction' | 'transfer' | 'recurring' | null

export function TransactionsPanel() {
  const queryClient = useQueryClient()
  const router = useRouter()

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: async () => (await listAccounts()).data.accounts,
  })
  const balancesQuery = useQuery({
    queryKey: queryKeys.balances,
    queryFn: async () => (await listBalances()).data.balances,
  })
  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions(),
    queryFn: async () => listTransactions({ pageSize: 100 }),
  })
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => (await listCategories()).data.categories,
  })
  const rulesQuery = useQuery({
    queryKey: queryKeys.recurringRules,
    queryFn: async () => (await listRecurringTransactionRules()).data.rules,
  })

  const accounts = accountsQuery.data ?? []
  const balances = balancesQuery.data ?? []
  const transactions = transactionsQuery.data?.data.transactions ?? []
  const transactionsTotal = transactionsQuery.data?.meta.pagination.total ?? 0
  const hasMoreTransactions = transactionsTotal > transactions.length
  const categories = categoriesQuery.data ?? []
  const rules = rulesQuery.data ?? []

  const loading =
    accountsQuery.isLoading ||
    balancesQuery.isLoading ||
    transactionsQuery.isLoading ||
    categoriesQuery.isLoading ||
    rulesQuery.isLoading

  const loadError =
    transactionsQuery.error ??
    accountsQuery.error ??
    categoriesQuery.error ??
    balancesQuery.error ??
    rulesQuery.error
  const error = loadError
    ? loadError instanceof Error
      ? loadError.message
      : 'Failed to load transactions'
    : null

  const [drawer, setDrawer] = useState<ActiveDrawer>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const {
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
  } = useTransactionFilters(transactions, accounts)

  const closeDrawer = () => {
    setDrawer(null)
    setEditingTransaction(null)
  }

  // TransactionForm / TransferForm own the actual create/update/transfer API
  // calls (see ../lib/transaction-input and ../services/transactions); once a
  // child form reports success, the container invalidates the query cache so
  // the ledger and balances refetch through React Query.
  const handleSaved = () => {
    // Invalidate by the ['transactions'] prefix so both the ledger
    // (queryKeys.transactions()) and the dashboard's recent-activity widget
    // (queryKeys.recentTransactions, keyed ['transactions', 'recent']) refetch.
    // Keying only transactions() would leave the dashboard widget stale.
    void queryClient.invalidateQueries({ queryKey: ['transactions'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.balances })
    closeDrawer()
  }

  const handleRecurringSaved = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurringRules })
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

      {!loading && hasMoreTransactions ? (
        <p className="muted">
          Showing the latest {transactions.length} of {transactionsTotal} transactions.
        </p>
      ) : null}

      {/* Transaction list — the focus of the view */}
      <TransactionList
        loading={loading}
        accounts={accounts}
        transactions={transactions}
        visibleTransactions={visibleTransactions}
        accountById={accountById}
        filtersActive={filtersActive}
        onAddAccount={() => router.push('/dashboard/accounts')}
        onAddTransaction={openAdd}
        onClearFilters={clearFilters}
        onEditTransaction={openEdit}
      />

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
