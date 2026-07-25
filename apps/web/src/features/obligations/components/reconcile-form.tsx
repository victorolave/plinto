'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { Transaction } from '../../transactions/services/transactions'
import type { ObligationInstance } from '../services/obligations'
import { reconcileObligation } from '../services/obligations'
import { Button } from '../../../components/ui/button'
import { Field, Select } from '../../../components/ui/field'
import { formatMoneyMagnitude } from '../../../components/ui/amount'

export interface ReconcileFormProps {
  obligation: ObligationInstance
  transactions: Transaction[]
  onSaved: () => void | Promise<void>
}

/**
 * Links an existing transaction to the obligation.
 *
 * The picker only offers transactions the server would actually accept —
 * expenses in the obligation's own currency — so a user is never walked into a
 * 409. The server still enforces every rule; this only avoids offering choices
 * that are certain to be rejected.
 */
export function ReconcileForm({
  obligation,
  transactions,
  onSaved,
}: ReconcileFormProps) {
  const eligible = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.type === 'expense' &&
          transaction.currency === obligation.currency,
      ),
    [transactions, obligation.currency],
  )

  const [transactionId, setTransactionId] = useState(eligible[0]?.id ?? '')

  const reconcileMutation = useMutation({
    mutationFn: (id: string) => reconcileObligation(obligation.id, id),
    onSuccess: () => {
      void onSaved()
    },
  })

  const error =
    reconcileMutation.error instanceof Error ? reconcileMutation.error.message : null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!transactionId) return
    reconcileMutation.mutate(transactionId)
  }

  if (eligible.length === 0) {
    return (
      <p className="muted">
        No expense in {obligation.currency} is available to settle this
        obligation. Record the payment as a transaction first.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <p className="muted">
          Expected{' '}
          <strong style={{ color: 'var(--text-strong)' }}>
            {formatMoneyMagnitude(obligation.expectedAmountMinor, obligation.currency)}
          </strong>
          {obligation.paidAmountMinor > 0 ? (
            <>
              {' '}· already settled{' '}
              {formatMoneyMagnitude(obligation.paidAmountMinor, obligation.currency)}
            </>
          ) : null}
        </p>

        <Field
          label="Transaction"
          hint="Only expenses in this obligation's currency can settle it"
          htmlFor="reconcile-transaction"
        >
          <Select
            id="reconcile-transaction"
            value={transactionId}
            onChange={(event) => setTransactionId(event.target.value)}
            required
          >
            {eligible.map((transaction) => (
              <option key={transaction.id} value={transaction.id}>
                {formatMoneyMagnitude(transaction.amountMinor, transaction.currency)} ·{' '}
                {transaction.description || 'No description'} ·{' '}
                {transaction.occurredAt.slice(0, 10)}
              </option>
            ))}
          </Select>
        </Field>

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={reconcileMutation.isPending}>
          {reconcileMutation.isPending ? 'Linking…' : 'Mark as settled'}
        </Button>
      </div>
    </form>
  )
}
