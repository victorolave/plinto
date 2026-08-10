'use client'

import { type FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreateCreditLineStatementSchema,
  UpdateCreditLineStatementSchema,
  toMajorUnitsString,
  toMinorUnits,
} from '@plinto/shared'
import {
  recordStatement,
  updateStatement,
  type CreditLine,
  type CreditLineStatement,
} from '../services/credit'
import { queryKeys } from '../../../lib/api/query-keys'
import { Button } from '../../../components/ui/button'
import { Field, Input } from '../../../components/ui/field'
import { amountInputStep, formatMoneyMagnitude } from '../../../components/ui/amount'

export interface StatementFormProps {
  line: CreditLine
  /** When present the form corrects that statement instead of recording one. */
  statement?: CreditLineStatement
  onSaved: () => void | Promise<void>
}

/** `2026-08-12T00:00:00.000Z` → `2026-08-12`, what a date input wants. */
const toDateInput = (iso: string): string => iso.slice(0, 10)

/**
 * Entering the statement the issuer sent, or fixing one already entered.
 *
 * Two amounts, two dates, once a month — the whole cost of keeping a rotating
 * line honest. The household never records the purchases behind the balance,
 * so what the issuer declares is the only figure that can be trusted.
 *
 * Correcting matters as much as recording. The advice is to enter a statement
 * when it arrives, and then its figures are right by construction — but a
 * household that enters one early, or fat-fingers a zero, must not be stuck
 * with the number. A system that stays correct only while its user keeps
 * perfect discipline is a system that will be wrong.
 *
 * The cutoff cannot be changed: the period is derived from it, so editing it
 * would move the obligation between months.
 */
export function StatementForm({ line, statement, onSaved }: StatementFormProps) {
  const queryClient = useQueryClient()
  const editing = statement !== undefined

  const [cutoffDate, setCutoffDate] = useState(
    statement ? toDateInput(statement.cutoffDate) : '',
  )
  const [dueDate, setDueDate] = useState(
    statement ? toDateInput(statement.dueDate) : '',
  )
  const [closingBalance, setClosingBalance] = useState(
    statement ? toMajorUnitsString(statement.closingBalanceMinor, statement.currency) : '',
  )
  const [amountDue, setAmountDue] = useState(
    statement ? toMajorUnitsString(statement.amountDueMinor, statement.currency) : '',
  )
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

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.creditSummary })
    void queryClient.invalidateQueries({
      queryKey: queryKeys.creditStatements(line.id),
    })
    // The statement drives an obligation, so the month's board and its totals
    // are stale whether it was just created or just corrected.
    void queryClient.invalidateQueries({ queryKey: ['obligations'] })
  }

  const saveMutation = useMutation({
    mutationFn: (input: {
      cutoffDate?: string
      dueDate: string
      closingBalanceMinor: number
      amountDueMinor: number
    }) =>
      editing
        ? updateStatement(line.id, statement.id, {
            dueDate: input.dueDate,
            closingBalanceMinor: input.closingBalanceMinor,
            amountDueMinor: input.amountDueMinor,
          })
        : recordStatement(line.id, {
            cutoffDate: input.cutoffDate as string,
            dueDate: input.dueDate,
            closingBalanceMinor: input.closingBalanceMinor,
            amountDueMinor: input.amountDueMinor,
          }),
    onSuccess: () => {
      invalidateAll()
      void onSaved()
    },
  })

  const submitting = saveMutation.isPending
  const error =
    validationError ??
    (saveMutation.error instanceof Error ? saveMutation.error.message : null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const payload = {
      cutoffDate: cutoffDate ? `${cutoffDate}T00:00:00.000Z` : '',
      dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : '',
      closingBalanceMinor,
      amountDueMinor: toMinorUnits(amountDue, line.currency),
    }

    // The edit schema omits the cutoff, so it is validated out of the payload
    // rather than merely hidden from the form.
    const result = editing
      ? UpdateCreditLineStatementSchema.safeParse({
          dueDate: payload.dueDate,
          closingBalanceMinor: payload.closingBalanceMinor,
          amountDueMinor: payload.amountDueMinor,
        })
      : CreateCreditLineStatementSchema.safeParse(payload)

    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Invalid statement')
      return
    }

    // The create schema refuses an amount due above the balance; the update one
    // cannot, since either field may arrive alone. Checked here so the message
    // appears beside the inputs rather than as a 422 from the server.
    if (payload.amountDueMinor > payload.closingBalanceMinor) {
      setValidationError('The amount due cannot exceed the closing balance')
      return
    }

    setValidationError(null)
    saveMutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <div className="form-grid">
          <Field
            label="Statement date"
            hint={editing ? 'Fixed — it decides which month this belongs to' : undefined}
            htmlFor="statement-cutoff"
          >
            <Input
              id="statement-cutoff"
              type="date"
              value={cutoffDate}
              onChange={(event) => setCutoffDate(event.target.value)}
              disabled={editing}
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

        {editing ? (
          <p className="muted">
            The payment on the obligations board changes with it. It cannot go
            below what you have already paid against this statement — undo the
            payment first if the issuer really lowered it after you paid.
          </p>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting}>
          {submitting
            ? 'Saving…'
            : editing
              ? 'Save changes'
              : 'Save statement'}
        </Button>
      </div>
    </form>
  )
}
