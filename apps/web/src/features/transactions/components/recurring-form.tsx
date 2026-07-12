'use client'

import { type FormEvent, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CreateRecurringTransactionRuleSchema } from '@plinto/shared'
import type { Account } from '../../accounts/services/accounts'
import type { TransactionType } from '../services/transactions'
import { createRecurringTransactionRule } from '../services/recurring-transactions'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { Repeat } from '../../../components/ui/icons'

const recurringTypeOptions: Array<{ value: TransactionType; label: string }> = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

/** Converts a date-only input (YYYY-MM-DD) to a UTC-midnight ISO instant.
 * Returns an empty string (rather than throwing) for an empty or invalid
 * value, so the schema can surface a proper validation error. */
function toStartDateIso(value: string): string {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export interface RecurringFormProps {
  accounts: Account[]
  /** Called after a rule is created — parent reloads and closes the drawer. */
  onSaved: () => void | Promise<void>
}

export function RecurringForm({ accounts, onSaved }: RecurringFormProps) {
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createRecurringTransactionRule>[0]) =>
      createRecurringTransactionRule(payload),
    onSuccess: () => {
      void onSaved()
    },
  })

  const submitting = createMutation.isPending
  const error =
    validationError ??
    (createMutation.error instanceof Error ? createMutation.error.message : null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const parsedAmount = parseFloat(amount)
    const parsedDay = parseInt(dayOfMonth, 10)

    const payload = {
      name: name.trim(),
      accountId,
      type,
      amountMinor: Math.round(parsedAmount * 100),
      dayOfMonth: parsedDay,
      startDate: toStartDateIso(startDate),
    }

    const result = CreateRecurringTransactionRuleSchema.safeParse(payload)
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Invalid recurring rule')
      return
    }

    setValidationError(null)
    createMutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <Field label="Name" htmlFor="recurring-name">
          <Input
            id="recurring-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Rent"
            required
          />
        </Field>

        <div className="form-grid">
          <Field label="Account" htmlFor="recurring-account">
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
          <Field label="Type" htmlFor="recurring-type">
            <Select
              id="recurring-type"
              value={type}
              onChange={(event) => setType(event.target.value as TransactionType)}
            >
              {recurringTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="form-grid">
          <Field label="Amount" htmlFor="recurring-amount">
            <Input
              id="recurring-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
            />
          </Field>
          <Field label="Day of month" hint="1–28" htmlFor="recurring-day">
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

        <Field label="Start date" htmlFor="recurring-start">
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
          {submitting ? 'Saving…' : 'Create monthly rule'}
        </Button>
      </div>
    </form>
  )
}
