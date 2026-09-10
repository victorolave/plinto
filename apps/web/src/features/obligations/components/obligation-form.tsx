'use client'

import { type FormEvent, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { CreateObligationSchema, toMajorUnitsString, toMinorUnits } from '@plinto/shared'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import { useValidationMessage } from '../../../lib/api/use-validation-message'
import { createObligation } from '../services/obligations'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { amountInputStep } from '../../../components/ui/amount'

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
  const t = useTranslations('obligations.form')
  const tCommon = useTranslations('common')
  const toErrorMessage = useErrorMessage()
  const toValidationMessage = useValidationMessage()
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
      expectedAmountMinor: toMinorUnits(amount, currency),
      currency,
    }

    // The shared schema also enforces that the due date falls inside the
    // period, so the client cannot record an obligation that would be
    // invisible in the month reporting it.
    const result = CreateObligationSchema.safeParse(payload)
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
        <Field label={t('name')} htmlFor="obligation-name">
          <Input
            id="obligation-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('namePlaceholder')}
            required
          />
        </Field>

        <div className="form-grid">
          <Field label={t('amount')} htmlFor="obligation-amount">
            <Input
              id="obligation-amount"
              type="number"
              min={amountInputStep(currency)}
              step={amountInputStep(currency)}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={toMajorUnitsString(0, currency)}
              required
            />
          </Field>
          <Field label={t('currency')} htmlFor="obligation-currency">
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
          label={t('dueDate')}
          hint={t('dueDateHint', { period })}
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
          {submitting ? tCommon('saving') : t('recordObligation')}
        </Button>
      </div>
    </form>
  )
}
