'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '../../../lib/api/use-error-message'
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
import { Pagination } from '../../../components/ui/pagination'
import { Amount } from '../../../components/ui/amount'
import { Tabs } from '../../../components/ui/tabs'
import { Drawer } from '../../../components/ui/drawer'
import { TrendDown, ArrowSwap, Plus, Repeat, Search } from '../../../components/ui/icons'
import { useTransactionFilters, DATE_PRESETS } from '../hooks/use-transaction-filters'
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

/**
 * Rows per page in the ledger.
 *
 * A screenful, not the contract's 100 ceiling. A page that has to be scrolled
 * to the end before its own controls appear is not a page, it is the same long
 * list with a button hidden under it — and on a phone that is several swipes
 * for every turn. Ten keeps the movements and the way to reach the rest
 * visible together, on a phone as well as on a desktop.
 */
const LEDGER_PAGE_SIZE = 10

/**
 * A stable empty array for the accounts the filters hook reads.
 *
 * `?? []` would build a new array on every render, and the hook's memos depend
 * on that identity — the ledger query would re-key itself forever.
 */
const EMPTY_ACCOUNTS: Awaited<ReturnType<typeof listAccounts>>['data']['accounts'] = []

export function TransactionsPanel() {
  const t = useTranslations('transactions')
  const toErrorMessage = useErrorMessage()
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

  // Declared before the ledger query because the query is *of* these filters:
  // narrowing happens in the database now, not over an array in the browser.
  const accountsForFilters = accountsQuery.data ?? EMPTY_ACCOUNTS
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
    filters,
    filtersActive,
    clearFilters,
  } = useTransactionFilters(accountsForFilters)

  const [page, setPage] = useState(1)

  // A filter change re-slices the whole ledger, so page 7 of the old results
  // is a page that may not exist in the new ones. Landing on an empty screen
  // after typing a search reads as "no matches" rather than as "wrong page".
  useEffect(() => {
    setPage(1)
  }, [filters])

  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions({ ...filters, page, pageSize: LEDGER_PAGE_SIZE }),
    queryFn: async () => listTransactions({ ...filters, page, pageSize: LEDGER_PAGE_SIZE }),
    // Keep the previous page on screen while the next one loads: without it
    // every page turn blanks the table and jumps the scroll position.
    placeholderData: keepPreviousData,
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

  const accounts = accountsForFilters
  const balances = balancesQuery.data ?? []
  const transactions = transactionsQuery.data?.data.transactions ?? []
  const transactionsTotal = transactionsQuery.data?.meta.pagination.total ?? 0
  const typeCounts = transactionsQuery.data?.meta.counts ?? { income: 0, expense: 0 }
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
  const error = activeError ? (toErrorMessage(activeError) ?? t('loadFailed')) : null

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
    // The ledger is newest-first, so a just-saved movement is on page 1.
    // Staying on page 9 would report success and show the reader nothing.
    setPage(1)
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


  return (
    <div className="page">
      {error ? <p className="error-text">{error}</p> : null}

      {/* Compact balances context */}
      {loading ? <BalanceStripSkeleton /> : null}
      {!loading && balances.length > 0 ? (
        <div className="balance-strip" aria-label={t('accountBalances')}>
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
            {
              id: 'all',
              label: t('filter.all'),
              count: typeCounts.income + typeCounts.expense,
            },
            { id: 'income', label: t('filter.income'), count: typeCounts.income },
            { id: 'expense', label: t('filter.expense'), count: typeCounts.expense },
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
            {t('transfer')}
          </Button>
          {/* Needs somewhere for the money to land; the lender itself can be
              created from inside the form. */}
          <Button
            variant="secondary"
            leftIcon={<TrendDown size={16} />}
            onClick={() => setDrawer('loan')}
            disabled={accounts.length === 0}
          >
            {t('loan')}
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Repeat size={16} />}
            onClick={() => setDrawer('debt')}
            disabled={accounts.length === 0}
          >
            {t('financed')}
          </Button>
          <Button
            leftIcon={<Plus size={18} />}
            onClick={openAdd}
            disabled={accounts.length === 0}
          >
            {t('addTransaction')}
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
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchLabel')}
          />
          <Select
            className="tx-account-filter"
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            aria-label={t('filterByAccount')}
          >
            <option value="">{t('allAccounts')}</option>
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
              aria-label={t('dateRangePreset')}
            >
              {DATE_PRESETS.map((value) => (
                <option key={value} value={value}>
                  {t(`datePreset.${value}`)}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              className="tx-date-input"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setCustomFrom(event.target.value)}
              aria-label={t('fromDate')}
            />
            <span className="tx-date-sep">→</span>
            <Input
              type="date"
              className="tx-date-input"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setCustomTo(event.target.value)}
              aria-label={t('toDate')}
            />
          </div>
        </div>
      ) : null}

      {/* Transaction list — the focus of the view */}
      <TransactionList
        loading={loading}
        accounts={accounts}
        transactions={transactions}
        visibleTransactions={transactions}
        accountById={accountById}
        filtersActive={filtersActive}
        onAddAccount={() => router.push('/dashboard/accounts')}
        onAddTransaction={openAdd}
        onClearFilters={clearFilters}
        onEditTransaction={openEdit}
      />

      {loading ? null : (
        <Pagination
          page={page}
          pageSize={LEDGER_PAGE_SIZE}
          total={transactionsTotal}
          onPageChange={setPage}
        />
      )}

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
        title={editingTransaction ? t('editTransaction') : t('addTransaction')}
        description={t('drawer.transactionDescription')}
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
        title={t('drawer.transferTitle')}
        description={t('drawer.transferDescription')}
      >
        <TransferForm accounts={accounts} onSaved={handleSaved} />
      </Drawer>

      <Drawer
        open={drawer === 'loan'}
        onClose={closeDrawer}
        title={t('drawer.loanTitle')}
        description={t('drawer.loanDescription')}
      >
        <LoanForm accounts={accounts} onSaved={handleSaved} />
      </Drawer>

      <Drawer
        open={drawer === 'debt'}
        onClose={closeDrawer}
        title={t('drawer.debtTitle')}
        description={t('drawer.debtDescription')}
      >
        <DebtForm accounts={accounts} onSaved={handleSaved} />
      </Drawer>

      {/* On-demand recurring rule creation / edit */}
      <Drawer
        open={drawer === 'recurring'}
        onClose={closeDrawer}
        title={editingRule ? t('drawer.editRuleTitle') : t('drawer.newRuleTitle')}
        description={t('drawer.ruleDescription')}
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
