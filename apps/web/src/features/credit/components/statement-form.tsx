'use client'

import { type FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateCreditLineStatementSchema, toMinorUnits } from '@plinto/shared'
import { recordStatement, type CreditLine } from '../services/credit'
import { queryKeys } from '../../../lib/api/query-keys'
import { Button } from '../../../components/ui/button'
import { Field, Input } from '../../../components/ui/field'
import { amountInputStep, formatMoneyMagnitude } from '../../../components/ui/amount'

export interface StatementFormProps {
  line: CreditLine
  onSaved: () => void | Promise<void>
}

/**
 * Entering the statement the issuer sent.
 *
 * Two amounts, two dates, once a month — and that is the whole cost of keeping
 * a rotating line honest in Plinto. The household never records the purchases
 * behind the balance, so what the issuer declares is the only figure that can
 * be trusted.
 *
 * Saving this also puts the payment on the obligations board, which is the
 * point: a bill that is not on the board is a bill nobody pays.
 */
export function StatementForm({ line, onSaved }: StatementFormProps) {
  const queryClient = useQueryClient()

  const [cutoffDate, setCutoffDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [closingBalance, setClosingBalance] = useState('')
  const [amountDue, setAmountDue] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const closingBalanceMinor = toMinorUnits(closingBalance, line.currency)

  /**
   * What the line will report as available once this is saved. Shown live so
   * the number is checked against the issuer's app while it is still open,
   * rather than discovered later on the board.
   */
  const availablePreview = Number.isFinite(closingBalanceMinor)
    ? line.limitMinor - closingBalanceMinor
    : null

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof recordStatement>[1]) =>
      recordStatement(line.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.creditSummary })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.creditStatements(line.id),
      })
      // The statement created an obligation, so the month's board and its
      // totals are stale now.
      void queryClient.invalidateQueries({ queryKey: ['obligations'] })
      void onSaved()
    },
  })

  const submitting = createMutation.isPending
  const error =
    validationError ??
    (createMutation.error instanceof Error ? createMutation.error.message : null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const result = CreateCreditLineStatementSchema.safeParse({
      cutoffDate: cutoffDate ? `${cutoffDate}T00:00:00.000Z` : '',
      dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : '',
      closingBalanceMinor,
      amountDueMinor: toMinorUnits(amountDue, line.currency),
    })

    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Invalid statement')
      return
    }

    setValidationError(null)
    createMutation.mutate(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <div className="form-grid">
          <Field label="Statement date" htmlFor="statement-cutoff">
            <Input
              id="statement-cutoff"
              type="date"
              value={cutoffDate}
              onChange={(event) => setCutoffDate(event.target.value)}
              required
            />
          </Field>
          <Field label="Payment due" htmlFor="statement-due">
            <Input
              id="statement-due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </Field>
        </div>

        <Field
          label="Total owed"
          hint="The full balance on the statement, not just this month's payment"
          htmlFor="statement-balance"
        >
          <Input
            id="statement-balance"
            type="number"
            min="0"
            step={amountInputStep(line.currency)}
            value={closingBalance}
            onChange={(event) => setClosingBalance(event.target.value)}
            required
          />
        </Field>

        <Field label="To pay this month" htmlFor="statement-due-amount">
          <Input
            id="statement-due-amount"
            type="number"
            min="0"
            step={amountInputStep(line.currency)}
            value={amountDue}
            onChange={(event) => setAmountDue(event.target.value)}
            required
          />
        </Field>

        {availablePreview !== null && closingBalance !== '' ? (
          <p className="muted">
            {availablePreview >= 0 ? (
              <>
                Leaves{' '}
                <strong style={{ color: 'var(--text-strong)' }}>
                  {formatMoneyMagnitude(availablePreview, line.currency)}
                </strong>{' '}
                available on this line.
              </>
            ) : (
              <>
                That is{' '}
                <strong style={{ color: 'var(--text-strong)' }}>
                  {formatMoneyMagnitude(-availablePreview, line.currency)}
                </strong>{' '}
                over your limit — recorded as it is, not refused.
              </>
            )}
          </p>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting}>
          {submitting ? 'Saving…' : 'Save statement'}
        </Button>
      </div>
    </form>
  )
}
