'use client'

import { type FormEvent, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import { useValidationMessage } from '../../../lib/api/use-validation-message'
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  toMajorUnitsString,
  toMinorUnits,
} from '@plinto/shared'
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
import { amountInputStep } from '../../../components/ui/amount'
import {
  buildTransactionCreateInput,
  buildTransactionUpdateInput,
  toOccurredAtIso,
  TRANSACTION_TYPES,
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
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const toErrorMessage = useErrorMessage()
  const toValidationMessage = useValidationMessage()
  const [type, setType] = useState<TransactionType>(editing?.type ?? 'income')
  const [selectedAccountId, setSelectedAccountId] = useState(
    editing?.accountId ?? accounts[0]?.id ?? '',
  )
  const [categoryId, setCategoryId] = useState<string | null>(
    editing?.categoryId ?? null,
  )
  // Amount is collected in major units and converted at the scale the currency
  // actually uses (ADR 0004's reference table, in @plinto/shared) — not the
  // ×100 this form used to assume for every currency.
  const [amount, setAmount] = useState(
    editing ? toMajorUnitsString(editing.amountMinor, editing.currency) : '',
  )
  const [description, setDescription] = useState(editing?.description ?? '')
  const [occurredAt, setOccurredAt] = useState(
    editing ? editing.occurredAt.slice(0, 10) : '',
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (input: ReturnType<typeof buildTransactionCreateInput>) =>
      createTransaction(input),
    onSuccess: () => {
      void onSaved()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: ReturnType<typeof buildTransactionUpdateInput>
    }) => updateTransaction(id, input),
    onSuccess: () => {
      void onSaved()
    },
  })

  const submitting = createMutation.isPending || updateMutation.isPending
  const mutationError = editing ? updateMutation.error : createMutation.error
  const error =
    validationError ?? toErrorMessage(mutationError)

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId)
  // The scale follows the account the transaction lands in: a transaction
  // inherits its account's currency (ADR 0004 §6), so that is the only currency
  // this amount can be expressed in.
  //
  // An unresolved account leaves this empty, which would scale by the ×100
  // default — unreachable, because the empty accountId it implies is rejected
  // by the schema before the amount is ever sent.
  const currency = selectedAccount?.currency ?? editing?.currency ?? ''

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const amountMinor = toMinorUnits(amount, currency)
    const trimmedDescription = description.trim()

    if (editing) {
      const input = buildTransactionUpdateInput({
        accountId: selectedAccountId,
        type,
        amountMinor,
        description: trimmedDescription || null,
        occurredAt: toOccurredAtIso(occurredAt),
        categoryId,
      })
      const result = UpdateTransactionSchema.safeParse(input)
      if (!result.success) {
        setValidationError(toValidationMessage(result.error.issues[0]) ?? t('form.invalid'))
        return
      }

      setValidationError(null)
      updateMutation.mutate({ id: editing.id, input })
      return
    }

    const input = buildTransactionCreateInput({
      accountId: selectedAccountId,
      type,
      amountMinor,
      description: trimmedDescription || undefined,
      occurredAt: toOccurredAtIso(occurredAt),
      ...(categoryId !== null ? { categoryId } : {}),
    })
    const result = CreateTransactionSchema.safeParse(input)
    if (!result.success) {
      setValidationError(toValidationMessage(result.error.issues[0]) ?? t('form.invalid'))
      return
    }

    setValidationError(null)
    createMutation.mutate(input)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <SegmentedControl
          options={TRANSACTION_TYPES.map((value) => ({ value, label: t(value) }))}
          value={type}
          onChange={(value) => {
            setType(value)
            setCategoryId(null)
          }}
        />

        <Field label={t('form.account')} htmlFor="tx-account">
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

        <Field label={t('form.category')} hint={t('form.optional')} htmlFor="tx-category">
          <CategorySelect
            type={type}
            value={categoryId}
            onChange={setCategoryId}
            categories={categories}
          />
        </Field>

        <Field label={t('form.amount')} htmlFor="tx-amount">
          <Input
            id="tx-amount"
            type="number"
            min={amountInputStep(currency)}
            step={amountInputStep(currency)}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={toMajorUnitsString(0, currency)}
            required
          />
        </Field>

        <Field label={t('form.description')} hint={t('form.optional')} htmlFor="tx-description">
          <Input
            id="tx-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('form.descriptionPlaceholder')}
          />
        </Field>

        <Field label={t('form.date')} hint={t('form.optional')} htmlFor="tx-date">
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
            ? tCommon('saving')
            : editing
              ? t('form.saveChanges')
              : t('form.recordTransaction')}
        </Button>
      </div>
    </form>
  )
}
