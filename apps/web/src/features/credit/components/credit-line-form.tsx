'use client'

import { type FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateCreditLineSchema, toMinorUnits } from '@plinto/shared'
import { createCreditLine } from '../services/credit'
import { queryKeys } from '../../../lib/api/query-keys'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { amountInputStep } from '../../../components/ui/amount'

export interface CreditLineFormProps {
  currencies: string[]
  onSaved: () => void | Promise<void>
}

/**
 * Recording a card or a rotating line.
 *
 * Three fields, and none of them is a billing day. What a line bills and when
 * is carried by each statement, because the lender decides it and can change
 * it — some of these offer a choice between monthly and biweekly. Asking here
 * would be storing a second opinion about a fact the statements already state.
 */
export function CreditLineForm({ currencies, onSaved }: CreditLineFormProps) {
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [limit, setLimit] = useState('')
  const [currency, setCurrency] = useState(currencies[0] ?? 'COP')
  const [validationError, setValidationError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createCreditLine>[0]) =>
      createCreditLine(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.creditLines })
      void queryClient.invalidateQueries({ queryKey: queryKeys.creditSummary })
      void onSaved()
    },
  })

  const submitting = createMutation.isPending
  const error =
    validationError ??
    (createMutation.error instanceof Error ? createMutation.error.message : null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const result = CreateCreditLineSchema.safeParse({
      name: name.trim(),
      limitMinor: toMinorUnits(limit, currency),
      currency,
    })

    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Invalid credit line')
      return
    }

    setValidationError(null)
    createMutation.mutate(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <Field label="Name" htmlFor="credit-name">
          <Input
            id="credit-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. ADDI, Visa Bancolombia"
            required
          />
        </Field>

        <div className="form-grid">
          <Field
            label="Credit limit"
            hint="Your ceiling today — you can change it whenever the issuer does"
            htmlFor="credit-limit"
          >
            <Input
              id="credit-limit"
              type="number"
              min="0"
              step={amountInputStep(currency)}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              required
            />
          </Field>
          <Field label="Currency" htmlFor="credit-currency">
            <Select
              id="credit-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              required
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <p className="muted">
          No cutoff or payment day here. Each statement brings its own dates, so
          a lender switching you from monthly to biweekly needs nothing changed.
        </p>

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting}>
          {submitting ? 'Saving…' : 'Add credit line'}
        </Button>
      </div>
    </form>
  )
}
