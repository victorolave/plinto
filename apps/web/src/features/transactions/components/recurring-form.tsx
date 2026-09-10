'use client'

import { type FormEvent, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import { useValidationMessage } from '../../../lib/api/use-validation-message'
import {
  CreateRecurringTransactionRuleSchema,
  UpdateRecurringTransactionRuleSchema,
  toMajorUnitsString,
  toMinorUnits,
} from '@plinto/shared'
import type { Account } from '../../accounts/services/accounts'
import type { TransactionType } from '../services/transactions'
import {
  type RecurringTransactionRule,
  createRecurringTransactionRule,
  updateRecurringTransactionRule,
} from '../services/recurring-transactions'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { Repeat } from '../../../components/ui/icons'
import { amountInputStep } from '../../../components/ui/amount'

/** Order only; labels come from `transactions.income` / `transactions.expense`. */
const RECURRING_TYPES: TransactionType[] = ['income', 'expense']

/** Converts a date-only input (YYYY-MM-DD) to a UTC-midnight ISO instant.
 * Returns an empty string (rather than throwing) for an empty or invalid
 * value, so the schema can surface a proper validation error. */
function toStartDateIso(value: string): string {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

/** ISO instant back to the YYYY-MM-DD a date input expects. */
function toDateInputValue(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export interface RecurringFormProps {
  accounts: Account[]
  /** When set, edits this rule; otherwise creates a new one. */
  editing?: RecurringTransactionRule | null
  /** Called after a rule is saved — parent reloads and closes the drawer. */
  onSaved: () => void | Promise<void>
}

export function RecurringForm({ accounts, editing = null, onSaved }: RecurringFormProps) {
  const t = useTranslations('transactions.recurringForm')
  const tTx = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const toErrorMessage = useErrorMessage()
  const toValidationMessage = useValidationMessage()
  const [name, setName] = useState(editing?.name ?? '')
  const [accountId, setAccountId] = useState(editing?.accountId ?? accounts[0]?.id ?? '')
  const [type, setType] = useState<TransactionType>(editing?.type ?? 'expense')
  const [amount, setAmount] = useState(
    editing ? toMajorUnitsString(editing.amountMinor, editing.currency) : '',
  )
  const [dayOfMonth, setDayOfMonth] = useState(editing?.dayOfMonth.toString() ?? '1')
  const [startDate, setStartDate] = useState(
    editing ? toDateInputValue(editing.startDate) : '',
  )
  // A rule's currency is its account's, and it is frozen once the rule exists
  // (see the submit handler), so an existing rule scales by the currency it was
  // created with rather than by whichever account happens to be selected now.
  const currency =
    editing?.currency ??
    accounts.find((account) => account.id === accountId)?.currency ??
    ''
  const [validationError, setValidationError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createRecurringTransactionRule>[0]) =>
      createRecurringTransactionRule(payload),
    onSuccess: () => {
      void onSaved()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: {
      id: string
      payload: Parameters<typeof updateRecurringTransactionRule>[1]
    }) => updateRecurringTransactionRule(input.id, input.payload),
    onSuccess: () => {
      void onSaved()
    },
  })

  const submitting = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error ?? updateMutation.error
  const error =
    validationError ?? toErrorMessage(mutationError)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const parsedDay = parseInt(dayOfMonth, 10)

    const amountMinor = toMinorUnits(amount, currency)

    // The account, type and currency are frozen once a rule exists: its past
    // periods are already posted as transactions carrying those values.
    if (editing) {
      const payload = {
        name: name.trim(),
        amountMinor,
        dayOfMonth: parsedDay,
        startDate: toStartDateIso(startDate),
      }

      const result = UpdateRecurringTransactionRuleSchema.safeParse(payload)
      if (!result.success) {
        setValidationError(toValidationMessage(result.error.issues[0]) ?? t('invalid'))
        return
      }

      setValidationError(null)
      updateMutation.mutate({ id: editing.id, payload })
      return
    }

    const payload = {
      name: name.trim(),
      accountId,
      type,
      amountMinor,
      dayOfMonth: parsedDay,
      startDate: toStartDateIso(startDate),
    }

    const result = CreateRecurringTransactionRuleSchema.safeParse(payload)
    if (!result.success) {
      setValidationError(toValidationMessage(result.error.issues[0]) ?? t('invalid'))
      return
    }

    setValidationError(null)
    createMutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <Field label={t('name')} htmlFor="recurring-name">
          <Input
            id="recurring-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Rent"
            required
          />
        </Field>

        {/* Account and type are fixed once a rule exists: the periods it has
            already posted are transactions carrying those exact values. */}
        {!editing ? (
          <div className="form-grid">
            <Field label={t('account')} htmlFor="recurring-account">
              <Select
                id="recurring-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                required
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('type')} htmlFor="recurring-type">
              <Select
                id="recurring-type"
                value={type}
                onChange={(event) => setType(event.target.value as TransactionType)}
              >
                {RECURRING_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {tTx(value)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        <div className="form-grid">
          <Field label={t('amount')} htmlFor="recurring-amount">
            <Input
              id="recurring-amount"
              type="number"
              min={amountInputStep(currency)}
              step={amountInputStep(currency)}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={toMajorUnitsString(0, currency)}
              required
            />
          </Field>
          <Field label={t('dayOfMonth')} hint={t('dayOfMonthHint')} htmlFor="recurring-day">
            <Input
              id="recurring-day"
              type="number"
              min="1"
              max="28"
              step="1"
              value={dayOfMonth}
              onChange={(event) => setDayOfMonth(event.target.value)}
              required
            />
          </Field>
        </div>

        <Field label={t('startDate')} htmlFor="recurring-start">
          <Input
            id="recurring-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </Field>

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button
          type="submit"
          block
          leftIcon={<Repeat size={16} />}
          disabled={submitting || !accountId}
        >
          {submitting
            ? tCommon('saving')
            : editing
              ? t('saveChanges')
              : t('createRule')}
        </Button>
      </div>
    </form>
  )
}
