'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateLoanSchema, isLiabilityAccountType, toMinorUnits } from '@plinto/shared'
import { createAccount, type Account } from '../../accounts/services/accounts'
import { recordLoan } from '../services/loans'
import { queryKeys } from '../../../lib/api/query-keys'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { amountInputStep } from '../../../components/ui/amount'
import { toOccurredAtIso } from '../../transactions/lib/transaction-input'

/** Sentinel for "this lender is not in the list yet". */
const NEW_LENDER = '__new__'

export interface LoanFormProps {
  accounts: Account[]
  onSaved: () => void | Promise<void>
}

/**
 * Recording a loan the household received.
 *
 * The form asks about the loan, not about the transfer underneath it. Somebody
 * borrowing from Lineru should not have to know that the ledger records it as a
 * movement between two accounts, nor that they must create the lender first —
 * so creating it is part of this flow rather than a prerequisite.
 */
export function LoanForm({ accounts, onSaved }: LoanFormProps) {
  const queryClient = useQueryClient()

  const lenders = useMemo(
    () => accounts.filter((account) => isLiabilityAccountType(account.type)),
    [accounts],
  )
  // A loan lands in something the household holds. Offering a debt account here
  // would be offering refinancing, which the API refuses.
  const destinations = useMemo(
    () => accounts.filter((account) => !isLiabilityAccountType(account.type)),
    [accounts],
  )

  const [lenderId, setLenderId] = useState(lenders[0]?.id ?? NEW_LENDER)
  const [newLenderName, setNewLenderName] = useState('')
  const [destinationId, setDestinationId] = useState(destinations[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const destination = destinations.find((account) => account.id === destinationId)
  // Both sides must share a currency, so the receiving account decides it —
  // including for a lender that does not exist yet.
  const currency = destination?.currency ?? ''
  const creatingLender = lenderId === NEW_LENDER

  const loanMutation = useMutation({
    mutationFn: async (input: {
      lenderAccountId: string
      destinationAccountId: string
      amountMinor: number
      description?: string
      occurredAt?: string
    }) => recordLoan(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.balances })
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.recentTransactions })
      void onSaved()
    },
  })

  const createLenderMutation = useMutation({
    mutationFn: (input: { name: string; currency: string }) =>
      createAccount({ name: input.name, type: 'debt', currency: input.currency }),
  })

  const submitting = loanMutation.isPending || createLenderMutation.isPending
  const mutationError = loanMutation.error ?? createLenderMutation.error
  const error =
    validationError ?? (mutationError instanceof Error ? mutationError.message : null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setValidationError(null)

    if (!destination) {
      setValidationError('Choose the account that received the money')
      return
    }

    let resolvedLenderId = lenderId
    if (creatingLender) {
      const name = newLenderName.trim()
      if (!name) {
        setValidationError('Name the lender')
        return
      }
      // Created in the loan's currency, because the API requires both sides to
      // agree and the receiving account is what fixes it.
      const created = await createLenderMutation.mutateAsync({
        name,
        currency: destination.currency,
      })
      resolvedLenderId = created.data.account.id
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts() })
    }

    const payload = {
      lenderAccountId: resolvedLenderId,
      destinationAccountId: destination.id,
      amountMinor: toMinorUnits(amount, currency),
      description: description.trim() || undefined,
      occurredAt: occurredAt ? toOccurredAtIso(occurredAt) : undefined,
    }

    const result = CreateLoanSchema.safeParse(payload)
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Invalid loan')
      return
    }

    loanMutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        {destinations.length === 0 ? (
          <p className="muted">
            You need an account to receive the money before recording a loan.
          </p>
        ) : null}

        <Field label="Received into" htmlFor="loan-destination">
          <Select
            id="loan-destination"
            value={destinationId}
            onChange={(event) => setDestinationId(event.target.value)}
            required
          >
            {destinations.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Lender" htmlFor="loan-lender">
          <Select
            id="loan-lender"
            value={lenderId}
            onChange={(event) => setLenderId(event.target.value)}
          >
            {lenders.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
            <option value={NEW_LENDER}>+ New lender…</option>
          </Select>
        </Field>

        {creatingLender ? (
          <Field
            label="Lender name"
            hint={currency ? `Tracked in ${currency}` : undefined}
            htmlFor="loan-lender-name"
          >
            <Input
              id="loan-lender-name"
              value={newLenderName}
              onChange={(event) => setNewLenderName(event.target.value)}
              placeholder="e.g. Lineru"
              required
            />
          </Field>
        ) : null}

        <Field label="Amount received" htmlFor="loan-amount">
          <Input
            id="loan-amount"
            type="number"
            min={amountInputStep(currency)}
            step={amountInputStep(currency)}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </Field>

        <Field label="Description" hint="Optional" htmlFor="loan-description">
          <Input
            id="loan-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. Anticipo de nómina"
          />
        </Field>

        <Field label="Date" hint="Optional" htmlFor="loan-date">
          <Input
            id="loan-date"
            type="date"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </Field>

        <p className="muted">
          This is not income. The money arrives in your account and the same
          amount appears as owed to the lender.
        </p>

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting || destinations.length === 0}>
          {submitting ? 'Recording…' : 'Record loan'}
        </Button>
      </div>
    </form>
  )
}
