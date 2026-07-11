'use client'

import { type FormEvent, useState } from 'react'
import type { Account } from '../../accounts/services/accounts'
import type { Category } from '../../categories/services/categories'
import {
  type Transaction,
  type TransactionType,
  createTransaction,
  updateTransaction,
} from '../services/transactions'
import { CategorySelect } from '../../categories/components/category-select'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select, SegmentedControl } from '../../../components/ui/field'
import {
  buildTransactionCreateInput,
  buildTransactionUpdateInput,
  toOccurredAtIso,
  transactionTypeOptions,
} from '../lib/transaction-input'

export interface TransactionFormProps {
  accounts: Account[]
  categories: Category[]
  /** When set, the form edits this transaction; otherwise it creates a new one. */
  editing: Transaction | null
  /** Called after a successful create/update — parent reloads and closes. */
  onSaved: () => void | Promise<void>
}

export function TransactionForm({
  accounts,
  categories,
  editing,
  onSaved,
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(editing?.type ?? 'income')
  const [selectedAccountId, setSelectedAccountId] = useState(
    editing?.accountId ?? accounts[0]?.id ?? '',
  )
  const [categoryId, setCategoryId] = useState<string | null>(
    editing?.categoryId ?? null,
  )
  // Amount is collected in major units and converted to minor via ×100 (ADR 0004).
  const [amount, setAmount] = useState(
    editing ? (editing.amountMinor / 100).toFixed(2) : '',
  )
  const [description, setDescription] = useState(editing?.description ?? '')
  const [occurredAt, setOccurredAt] = useState(
    editing ? editing.occurredAt.slice(0, 10) : '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      if (editing) {
        await updateTransaction(
          editing.id,
          buildTransactionUpdateInput({
            accountId: selectedAccountId,
            type,
            amountMinor,
            description: trimmedDescription || null,
            occurredAt: toOccurredAtIso(occurredAt),
            categoryId,
          }),
        )
      } else {
        await createTransaction(
          buildTransactionCreateInput({
            accountId: selectedAccountId,
            type,
            amountMinor,
            description: trimmedDescription || undefined,
            occurredAt: toOccurredAtIso(occurredAt),
            ...(categoryId !== null ? { categoryId } : {}),
          }),
        )
      }

      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
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
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting || !selectedAccountId}>
          {submitting
            ? 'Saving…'
            : editing
              ? 'Save changes'
              : 'Record transaction'}
        </Button>
      </div>
    </form>
  )
}
