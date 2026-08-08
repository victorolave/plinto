'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listAccounts } from '../../accounts/services/accounts'
import { Transaction, listBalances, listTransactions } from '../services/transactions'
import {
  RecurringTransactionRule,
  archiveRecurringTransactionRule,
  listRecurringTransactionRules,
  pauseRecurringTransactionRule,
  restoreRecurringTransactionRule,
  resumeRecurringTransactionRule,
} from '../services/recurring-transactions'
import { queryKeys } from '../../../lib/api/query-keys'
import { RecurringSection } from './recurring-section'
import { RecurringForm } from './recurring-form'
import { TransactionForm } from './transaction-form'
import { TransactionList } from './transaction-list'
import { TransferForm } from './transfer-form'
import { LoanForm } from '../../debts/components/loan-form'
import { DebtForm } from '../../debts/components/debt-form'
import { BalanceStripSkeleton } from './transactions-skeleton'
import { listCategories } from '../../categories/services/categories'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input, Select } from '../../../components/ui/field'
import { Amount } from '../../../components/ui/amount'
import { Tabs } from '../../../components/ui/tabs'
import { Drawer } from '../../../components/ui/drawer'
import { TrendDown, ArrowSwap, Plus, Repeat, Search } from '../../../components/ui/icons'
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

type ActiveDrawer = 'transaction' | 'transfer' | 'loan' | 'debt' | 'recurring' | null

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
  // Archived rules are fetched too: the section folds them behind a toggle
  // rather than hiding them entirely, so restoring one never needs a refetch.
  const rulesQuery = useQuery({
    queryKey: queryKeys.recurringRules,
    queryFn: async () =>
      (await listRecurringTransactionRules({ includeArchived: true })).data.rules,
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
  const [drawer, setDrawer] = useState<ActiveDrawer>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [editingRule, setEditingRule] = useState<RecurringTransactionRule | null>(null)

  // One mutation per lifecycle action, all invalidating the same key the rules
  // query reads, so the list reflects the new state without a manual refetch.
  const invalidateRules = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurringRules })
  }

  const pauseRuleMutation = useMutation({
    mutationFn: (id: string) => pauseRecurringTransactionRule(id),
    onSuccess: invalidateRules,
  })
  const resumeRuleMutation = useMutation({
    mutationFn: (id: string) => resumeRecurringTransactionRule(id),
    onSuccess: invalidateRules,
  })
  const archiveRuleMutation = useMutation({
    mutationFn: (id: string) => archiveRecurringTransactionRule(id),
    onSuccess: invalidateRules,
  })
  const restoreRuleMutation = useMutation({
    mutationFn: (id: string) => restoreRecurringTransactionRule(id),
    onSuccess: invalidateRules,
  })

  // A rejected lifecycle action (e.g. resuming an archived rule) must surface
  // as loudly as a failed load, so both feed the same banner.
  const activeError =
    pauseRuleMutation.error ??
    resumeRuleMutation.error ??
    archiveRuleMutation.error ??
    restoreRuleMutation.error ??
    loadError
  const error = activeError
    ? activeError instanceof Error
      ? activeError.message
      : 'Failed to load transactions'
    : null

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
    setEditingRule(null)
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
    invalidateRules()
    closeDrawer()
  }

  const openAddRule = () => {
    setEditingRule(null)
    setDrawer('recurring')
  }

  const openEditRule = (rule: RecurringTransactionRule) => {
    setEditingRule(rule)
    setDrawer('recurring')
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
          {/* Needs somewhere for the money to land; the lender itself can be
              created from inside the form. */}
          <Button
            variant="secondary"
            leftIcon={<TrendDown size={16} />}
            onClick={() => setDrawer('loan')}
            disabled={accounts.length === 0}
          >
            Loan
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Repeat size={16} />}
            onClick={() => setDrawer('debt')}
            disabled={accounts.length === 0}
          >
            Financed
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
        onAdd={openAddRule}
        onEdit={openEditRule}
        onPause={(rule) => pauseRuleMutation.mutate(rule.id)}
        onResume={(rule) => resumeRuleMutation.mutate(rule.id)}
        onArchive={(rule) => archiveRuleMutation.mutate(rule.id)}
        onRestore={(rule) => restoreRuleMutation.mutate(rule.id)}
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

      <Drawer
        open={drawer === 'loan'}
        onClose={closeDrawer}
        title="Record a loan"
        description="Money you received and owe back"
      >
        <LoanForm accounts={accounts} onSaved={handleSaved} />
      </Drawer>

      <Drawer
        open={drawer === 'debt'}
        onClose={closeDrawer}
        title="Record a financed purchase"
        description="Fixed installments that end on their own"
      >
        <DebtForm accounts={accounts} onSaved={handleSaved} />
      </Drawer>

      {/* On-demand recurring rule creation / edit */}
      <Drawer
        open={drawer === 'recurring'}
        onClose={closeDrawer}
        title={editingRule ? 'Edit recurring rule' : 'New recurring rule'}
        description="Posts automatically each month when due"
      >
        <RecurringForm
          accounts={accounts}
          editing={editingRule}
          onSaved={handleRecurringSaved}
        />
      </Drawer>
    </div>
  )
}
