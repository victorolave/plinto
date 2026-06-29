'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { listAccounts } from '../../accounts/services/accounts'
import type { Account } from '../../accounts/services/accounts'
import {
  AccountBalance,
  Transaction,
  TransactionType,
  createTransaction,
  createTransfer,
  listBalances,
  listTransactions,
  updateTransaction,
} from '../services/transactions'
import { RecurringTransactionsPanel } from './recurring-transactions-panel'
import { Category } from '../../categories/services/categories'
import { listCategories } from '../../categories/services/categories'
import { CategorySelect } from '../../categories/components/category-select'
import { Card, CardHeader } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select, SegmentedControl } from '../../../components/ui/field'
import { Amount } from '../../../components/ui/amount'
import { Badge } from '../../../components/ui/badge'
import { Tabs } from '../../../components/ui/tabs'
import {
  Briefcase,
  Cart,
  Pencil,
  Repeat,
  ArrowSwap,
} from '../../../components/ui/icons'

export interface TransactionCreateInput {
  accountId: string
  type: TransactionType
  amountMinor: number
  description?: string
  occurredAt?: string
  categoryId?: string
}

export interface TransactionUpdateInput {
  accountId?: string
  type?: TransactionType
  amountMinor?: number
  description?: string | null
  occurredAt?: string
  categoryId?: string | null
}

export function buildTransactionCreateInput(input: TransactionCreateInput): TransactionCreateInput {
  const result: TransactionCreateInput = {
    accountId: input.accountId,
    type: input.type,
    amountMinor: input.amountMinor,
  }
  if (input.description !== undefined) result.description = input.description
  if (input.occurredAt !== undefined) result.occurredAt = input.occurredAt
  if (input.categoryId !== undefined) result.categoryId = input.categoryId
  return result
}

export function buildTransactionUpdateInput(input: TransactionUpdateInput): TransactionUpdateInput {
  const result: TransactionUpdateInput = {}
  if (input.accountId !== undefined) result.accountId = input.accountId
  if (input.type !== undefined) result.type = input.type
  if (input.amountMinor !== undefined) result.amountMinor = input.amountMinor
  if (input.description !== undefined) result.description = input.description
  if (input.occurredAt !== undefined) result.occurredAt = input.occurredAt
  if ('categoryId' in input) result.categoryId = input.categoryId
  return result
}

export function formatOccurredAtDate(occurredAt: string): string {
  if (!occurredAt) return ''
  // occurredAt is stored as a UTC instant; date-only inputs are persisted at UTC
  // midnight. Render the UTC calendar date so the displayed day matches the date
  // the user picked, avoiding a local-timezone off-by-one (issue #6).
  return new Date(occurredAt).toLocaleDateString(undefined, { timeZone: 'UTC' })
}

const transactionTypeOptions: Array<{ value: TransactionType; label: string }> = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

export function isAutomaticRecurringTransaction(transaction: Pick<Transaction, 'source' | 'recurringRuleId' | 'recurringPeriod'>): boolean {
  return transaction.source === 'job' && Boolean(transaction.recurringRuleId) && Boolean(transaction.recurringPeriod)
}

type HistoryFilter = 'all' | 'income' | 'expense'

export function TransactionsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [type, setType] = useState<TransactionType>('income')
  // Amount is collected in major units (e.g. 100.50 COP) and converted to minor
  // units via Math.round(amount * 100). This ×100 assumption is an MVP simplification
  // pending a per-currency minor-units table (ADR 0004).
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [transferSourceAccountId, setTransferSourceAccountId] = useState('')
  const [transferDestAccountId, setTransferDestAccountId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDescription, setTransferDescription] = useState('')
  const [transferOccurredAt, setTransferOccurredAt] = useState('')
  const [transferSubmitting, setTransferSubmitting] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferDestAmount, setTransferDestAmount] = useState('')
  const [transferFxRate, setTransferFxRate] = useState('')
  const [transferFeeMinor, setTransferFeeMinor] = useState('')

  const sourceAccount = accounts.find((a) => a.id === transferSourceAccountId)
  const destAccount = accounts.find((a) => a.id === transferDestAccountId)
  const isCrossCurrency = sourceAccount && destAccount && sourceAccount.currency !== destAccount.currency

  useEffect(() => {
    if (!isCrossCurrency) {
      setTransferDestAmount('')
      setTransferFxRate('')
      setTransferFeeMinor('')
    }
  }, [isCrossCurrency])

  const loadData = async () => {
    const [balancesRes, transactionsRes] = await Promise.all([
      listBalances(),
      listTransactions(),
    ])
    setBalances(balancesRes.data.balances)
    setTransactions(transactionsRes.data.transactions)
  }

  const resetForm = () => {
    setType('income')
    setAmount('')
    setDescription('')
    setOccurredAt('')
    setCategoryId(null)
    setEditingTransactionId(null)
    if (accounts.length > 0) {
      setSelectedAccountId(accounts[0].id)
    }
  }

  const startEditing = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id)
    setSelectedAccountId(transaction.accountId)
    setType(transaction.type)
    setAmount((transaction.amountMinor / 100).toFixed(2))
    setDescription(transaction.description ?? '')
    setOccurredAt(transaction.occurredAt.slice(0, 10))
    setCategoryId(transaction.categoryId ?? null)
    setError(null)
  }

  const toOccurredAtIso = (value: string) => {
    if (!value) return undefined
    return new Date(`${value}T00:00:00.000Z`).toISOString()
  }

  useEffect(() => {
    const run = async () => {
      try {
        const [accountsRes, balancesRes, transactionsRes, categoriesRes] = await Promise.all([
          listAccounts(),
          listBalances(),
          listTransactions(),
          listCategories(),
        ])
        setAccounts(accountsRes.data.accounts)
        setBalances(balancesRes.data.balances)
        setTransactions(transactionsRes.data.transactions)
        setCategories(categoriesRes.data.categories)
        const loadedAccounts = accountsRes.data.accounts
        if (loadedAccounts.length > 0) {
          setSelectedAccountId(loadedAccounts[0].id)
          setTransferSourceAccountId(loadedAccounts[0].id)
          // Default the destination to a different account so the same-account
          // guard isn't tripped by an empty initial selection.
          setTransferDestAccountId((loadedAccounts[1] ?? loadedAccounts[0]).id)
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load transactions',
        )
      } finally {
        setLoading(false)
      }
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const parsedAmount = parseFloat(amount)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const amountMinor = Math.round(parsedAmount * 100)
      const trimmedDescription = description.trim()

      if (editingTransactionId) {
        await updateTransaction(editingTransactionId, buildTransactionUpdateInput({
          accountId: selectedAccountId,
          type,
          amountMinor,
          description: trimmedDescription || null,
          occurredAt: toOccurredAtIso(occurredAt),
          categoryId: categoryId,
        }))
      } else {
        await createTransaction(buildTransactionCreateInput({
          accountId: selectedAccountId,
          type,
          amountMinor,
          description: trimmedDescription || undefined,
          occurredAt: toOccurredAtIso(occurredAt),
          ...(categoryId !== null ? { categoryId } : {}),
        }))
      }

      resetForm()
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save transaction',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleTransfer = async (event: FormEvent) => {
    event.preventDefault()

    const parsedAmount = parseFloat(transferAmount)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setTransferError('Enter an amount greater than zero')
      return
    }

    if (!transferSourceAccountId || !transferDestAccountId) {
      setTransferError('Select both source and destination accounts')
      return
    }

    if (transferSourceAccountId === transferDestAccountId) {
      setTransferError('Source and destination accounts must differ')
      return
    }

    const sourceAmountMinor = Math.round(parsedAmount * 100)
    let destinationAmountMinor: number | undefined
    let fxRateValue: string | undefined

    if (isCrossCurrency) {
      const parsedDestAmount = parseFloat(transferDestAmount)
      if (Number.isNaN(parsedDestAmount) || parsedDestAmount <= 0) {
        setTransferError('Enter a destination amount greater than zero')
        return
      }
      const fxRateTrimmed = transferFxRate.trim()
      if (!fxRateTrimmed || !/^\d{1,12}(\.\d{1,8})?$/.test(fxRateTrimmed)) {
        setTransferError('Enter a valid FX rate (e.g. 4200.00)')
        return
      }
      destinationAmountMinor = Math.round(parsedDestAmount * 100)
      fxRateValue = fxRateTrimmed
    }

    const parsedFee = transferFeeMinor.trim() ? parseInt(transferFeeMinor, 10) : undefined
    const feeMinor = parsedFee !== undefined && !Number.isNaN(parsedFee) && parsedFee >= 0 ? parsedFee : undefined

    setTransferSubmitting(true)
    setTransferError(null)

    try {
      const trimmedDescription = transferDescription.trim()
      await createTransfer({
        sourceAccountId: transferSourceAccountId,
        destinationAccountId: transferDestAccountId,
        sourceAmountMinor,
        destinationAmountMinor,
        fxRate: fxRateValue,
        feeMinor,
        description: trimmedDescription || undefined,
        occurredAt: toOccurredAtIso(transferOccurredAt),
      })

      setTransferAmount('')
      setTransferDestAmount('')
      setTransferFxRate('')
      setTransferFeeMinor('')
      setTransferDescription('')
      setTransferOccurredAt('')
      await loadData()
    } catch (err) {
      setTransferError(
        err instanceof Error ? err.message : 'Failed to create transfer',
      )
    } finally {
      setTransferSubmitting(false)
    }
  }

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const visibleTransactions = useMemo(
    () =>
      transactions.filter((transaction) =>
        historyFilter === 'all' ? true : transaction.type === historyFilter,
      ),
    [transactions, historyFilter],
  )

  const incomeCount = transactions.filter((t) => t.type === 'income').length
  const expenseCount = transactions.filter((t) => t.type === 'expense').length

  return (
    <div className="page">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          gap: 'var(--space-5)',
          alignItems: 'start',
        }}
      >
        {/* Record transaction */}
        <Card>
          <CardHeader
            title={editingTransactionId ? 'Edit transaction' : 'Record transaction'}
            subtitle="Logged to your household ledger"
          />
          <form onSubmit={handleSubmit} className="stack">
            <SegmentedControl
              options={transactionTypeOptions}
              value={type}
              onChange={(value) => {
                setType(value)
                setCategoryId(null)
              }}
            />

            <Field label="Account" htmlFor="tx-account">
              <Select
                id="tx-account"
                value={selectedAccountId}
                onChange={(event) => setSelectedAccountId(event.target.value)}
                required
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Category" hint="Optional" htmlFor="tx-category">
              <CategorySelect
                type={type}
                value={categoryId}
                onChange={setCategoryId}
                categories={categories}
              />
            </Field>

            <Field label="Amount" htmlFor="tx-amount">
              <Input
                id="tx-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
              />
            </Field>

            <Field label="Description" hint="Optional" htmlFor="tx-description">
              <Input
                id="tx-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="e.g. Mercadona"
              />
            </Field>

            <Field label="Date" hint="Optional" htmlFor="tx-date">
              <Input
                id="tx-date"
                type="date"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
            </Field>

            {error ? <p className="error-text">{error}</p> : null}

            <div className="inline-actions">
              <Button type="submit" disabled={submitting || !selectedAccountId}>
                {submitting
                  ? 'Saving…'
                  : editingTransactionId
                    ? 'Save correction'
                    : 'Record transaction'}
              </Button>
              {editingTransactionId ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={resetForm}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        {/* Transfer between accounts */}
        <Card>
          <CardHeader
            title="Transfer between accounts"
            subtitle="Move money with explicit FX when currencies differ"
          />
          <form onSubmit={handleTransfer} className="stack">
            {accounts.length < 2 ? (
              <p className="muted">You need at least two accounts to transfer.</p>
            ) : null}

            <Field label="From account" htmlFor="transfer-from">
              <Select
                id="transfer-from"
                value={transferSourceAccountId}
                onChange={(event) => setTransferSourceAccountId(event.target.value)}
                required
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="To account" htmlFor="transfer-to">
              <Select
                id="transfer-to"
                value={transferDestAccountId}
                onChange={(event) => setTransferDestAccountId(event.target.value)}
                required
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={isCrossCurrency ? `Amount (${sourceAccount?.currency ?? 'source'})` : 'Amount'}
              htmlFor="transfer-amount"
            >
              <Input
                id="transfer-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={transferAmount}
                onChange={(event) => setTransferAmount(event.target.value)}
                placeholder="0.00"
                required
              />
            </Field>

            {isCrossCurrency ? (
              <>
                <Field
                  label={`Destination amount (${destAccount?.currency ?? 'destination'})`}
                  htmlFor="transfer-dest-amount"
                >
                  <Input
                    id="transfer-dest-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={transferDestAmount}
                    onChange={(event) => setTransferDestAmount(event.target.value)}
                    placeholder="0.00"
                    required
                  />
                </Field>
                <Field label="FX rate" htmlFor="transfer-fx">
                  <Input
                    id="transfer-fx"
                    type="text"
                    value={transferFxRate}
                    onChange={(event) => setTransferFxRate(event.target.value)}
                    placeholder="e.g. 4200.00"
                    required
                  />
                </Field>
                {transferAmount && transferDestAmount && transferFxRate ? (
                  <p className="muted">
                    {parseFloat(transferAmount).toFixed(2)} {sourceAccount?.currency} →{' '}
                    {parseFloat(transferDestAmount).toFixed(2)} {destAccount?.currency} at rate{' '}
                    {transferFxRate}
                  </p>
                ) : null}
                <Field label="Fee" hint="Optional, in minor units" htmlFor="transfer-fee">
                  <Input
                    id="transfer-fee"
                    type="number"
                    min="0"
                    step="1"
                    value={transferFeeMinor}
                    onChange={(event) => setTransferFeeMinor(event.target.value)}
                    placeholder="0"
                  />
                </Field>
              </>
            ) : null}

            <Field label="Description" hint="Optional" htmlFor="transfer-description">
              <Input
                id="transfer-description"
                value={transferDescription}
                onChange={(event) => setTransferDescription(event.target.value)}
              />
            </Field>

            <Field label="Date" hint="Optional" htmlFor="transfer-date">
              <Input
                id="transfer-date"
                type="date"
                value={transferOccurredAt}
                onChange={(event) => setTransferOccurredAt(event.target.value)}
              />
            </Field>

            {transferError ? <p className="error-text">{transferError}</p> : null}

            <div className="inline-actions">
              <Button
                type="submit"
                leftIcon={<ArrowSwap size={16} />}
                disabled={
                  transferSubmitting ||
                  accounts.length < 2 ||
                  !transferSourceAccountId ||
                  !transferDestAccountId
                }
              >
                {transferSubmitting ? 'Transferring…' : 'Transfer'}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <RecurringTransactionsPanel accounts={accounts} />

      {/* Balances */}
      <Card flush>
        <div style={{ padding: 'var(--space-6) var(--space-6) 0' }}>
          <CardHeader title="Balances" subtitle="Current balance per account" />
        </div>
        <div style={{ padding: '0 var(--space-6) var(--space-4)' }}>
          {loading ? <p className="muted">Loading balances…</p> : null}
          {!loading && balances.length === 0 ? <p className="muted">No balances yet.</p> : null}
          {balances.map((balance) => (
            <div key={balance.accountId} className="data-row">
              <span className="account-name">{balance.accountName}</span>
              <Amount minor={balance.balanceMinor} currency={balance.currency} size="sm" />
            </div>
          ))}
        </div>
      </Card>

      {/* History */}
      <Card flush>
        <div style={{ padding: 'var(--space-6) var(--space-6) 0' }}>
          <CardHeader title="Transaction history" />
          <Tabs
            items={[
              { id: 'all', label: 'All', count: transactions.length },
              { id: 'income', label: 'Income', count: incomeCount },
              { id: 'expense', label: 'Expenses', count: expenseCount },
            ]}
            value={historyFilter}
            onChange={setHistoryFilter}
          />
        </div>
        <div style={{ padding: '0 var(--space-4) var(--space-3)' }}>
          {loading ? (
            <p className="muted" style={{ padding: 'var(--space-3) var(--space-2)' }}>
              Loading transactions…
            </p>
          ) : null}
          {!loading && visibleTransactions.length === 0 ? (
            <p className="muted" style={{ padding: 'var(--space-3) var(--space-2)' }}>
              No transactions yet. Record your first transaction.
            </p>
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
                    onClick={() => startEditing(transaction)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
