'use client'

import { type FormEvent, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CreateObligationSchema } from '@plinto/shared'
import { createObligation } from '../services/obligations'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'

/** Converts a date-only input (YYYY-MM-DD) to a UTC-midnight ISO instant. */
function toDueDateIso(value: string): string {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

/** First day of the period, so the date picker opens inside the right month. */
function defaultDueDate(period: string): string {
  return `${period}-01`
}

export interface ObligationFormProps {
  period: string
  /** Currencies already in play for this household, to avoid free-typing. */
  currencies: string[]
  onSaved: () => void | Promise<void>
}

/**
 * Records a one-off obligation — a tax filing, a school enrolment. Anything
 * recurring belongs to a rule instead, which materializes its own instances
 * every period.
 */
export function ObligationForm({ period, currencies, onSaved }: ObligationFormProps) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(defaultDueDate(period))
  const [currency, setCurrency] = useState(currencies[0] ?? 'COP')
  const [validationError, setValidationError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createObligation>[0]) =>
      createObligation(payload),
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

    const payload = {
      name: name.trim(),
      period,
      dueDate: toDueDateIso(dueDate),
      expectedAmountMinor: Math.round(parseFloat(amount) * 100),
      currency,
    }

    // The shared schema also enforces that the due date falls inside the
    // period, so the client cannot record an obligation that would be
    // invisible in the month reporting it.
    const result = CreateObligationSchema.safeParse(payload)
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Invalid obligation')
      return
    }

    setValidationError(null)
    createMutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <Field label="Name" htmlFor="obligation-name">
          <Input
            id="obligation-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Income tax filing"
            required
          />
        </Field>

        <div className="form-grid">
          <Field label="Amount" htmlFor="obligation-amount">
            <Input
              id="obligation-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
            />
          </Field>
          <Field label="Currency" htmlFor="obligation-currency">
            <Select
              id="obligation-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {(currencies.length > 0 ? currencies : ['COP']).map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Due date"
          hint={`Must fall inside ${period}`}
          htmlFor="obligation-due"
        >
          <Input
            id="obligation-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required
          />
        </Field>

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting}>
          {submitting ? 'Saving…' : 'Record obligation'}
        </Button>
      </div>
    </form>
  )
}
