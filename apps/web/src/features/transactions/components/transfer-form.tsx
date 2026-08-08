'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CreateTransferSchema, toMajorUnitsString, toMinorUnits } from '@plinto/shared'
import type { Account } from '../../accounts/services/accounts'
import { createTransfer } from '../services/transactions'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { ArrowSwap } from '../../../components/ui/icons'
import { amountInputStep, formatMoneyMagnitude } from '../../../components/ui/amount'
import { toOccurredAtIso } from '../lib/transaction-input'

export interface TransferFormProps {
  accounts: Account[]
  /** Called after a successful transfer — parent reloads and closes. */
  onSaved: () => void | Promise<void>
}

export function TransferForm({ accounts, onSaved }: TransferFormProps) {
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? '')
  const [destAccountId, setDestAccountId] = useState(
    (accounts[1] ?? accounts[0])?.id ?? '',
  )
  const [amount, setAmount] = useState('')
  const [destAmount, setDestAmount] = useState('')
  const [fxRate, setFxRate] = useState('')
  const [fee, setFee] = useState('')
  const [description, setDescription] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const transferMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createTransfer>[0]) => createTransfer(payload),
    onSuccess: () => {
      void onSaved()
    },
  })

  const submitting = transferMutation.isPending
  const error =
    validationError ??
    (transferMutation.error instanceof Error ? transferMutation.error.message : null)

  const sourceAccount = accounts.find((a) => a.id === sourceAccountId)
  const destAccount = accounts.find((a) => a.id === destAccountId)
  // Empty until an account is picked. `minorUnitExponent` falls back to two
  // decimals for an empty code, which never reaches the API: the schema rejects
  // the missing accountId that implies before anything is sent.
  const sourceCurrency = sourceAccount?.currency ?? ''
  const destinationCurrency = destAccount?.currency ?? ''
  const isCrossCurrency =
    sourceAccount && destAccount && sourceCurrency !== destinationCurrency

  useEffect(() => {
    if (!isCrossCurrency) {
      setDestAmount('')
      setFxRate('')
      setFee('')
    }
  }, [isCrossCurrency])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!sourceAccountId || !destAccountId) {
      setValidationError('Select both source and destination accounts')
      return
    }

    // Each side scales by its OWN account's currency. They can differ — a
    // COP→USD transfer shifts the source by nothing and the destination by two
    // places — which is exactly what a single shared ×100 could not express.
    const sourceAmountMinor = toMinorUnits(amount, sourceCurrency)
    let destinationAmountMinor: number | undefined
    let fxRateValue: string | undefined

    if (isCrossCurrency) {
      destinationAmountMinor = toMinorUnits(destAmount, destinationCurrency)
      fxRateValue = fxRate.trim() || undefined
    }

    // The fee is charged on the source side, so it scales by the source
    // currency. It used to be typed in raw minor units by the person filling
    // the form; it is now an ordinary amount like every other money field.
    const feeValue = fee.trim() ? toMinorUnits(fee, sourceCurrency) : undefined
    const trimmedDescription = description.trim()

    const payload = {
      sourceAccountId,
      destinationAccountId: destAccountId,
      sourceAmountMinor,
      destinationAmountMinor,
      fxRate: fxRateValue,
      feeMinor: feeValue,
      description: trimmedDescription || undefined,
      occurredAt: toOccurredAtIso(occurredAt),
    }

    const result = CreateTransferSchema.safeParse(payload)
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Invalid transfer')
      return
    }

    setValidationError(null)
    transferMutation.mutate(payload)
  }

  const canSubmit =
    !submitting && accounts.length >= 2 && sourceAccountId && destAccountId

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        {accounts.length < 2 ? (
          <p className="muted">You need at least two accounts to transfer.</p>
        ) : null}

        <Field label="From account" htmlFor="transfer-from">
          <Select
            id="transfer-from"
            value={sourceAccountId}
            onChange={(event) => setSourceAccountId(event.target.value)}
            required
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="To account" htmlFor="transfer-to">
          <Select
            id="transfer-to"
            value={destAccountId}
            onChange={(event) => setDestAccountId(event.target.value)}
            required
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={
            isCrossCurrency
              ? `Amount (${sourceAccount?.currency ?? 'source'})`
              : 'Amount'
          }
          htmlFor="transfer-amount"
        >
          <Input
            id="transfer-amount"
            type="number"
            min={amountInputStep(sourceCurrency)}
            step={amountInputStep(sourceCurrency)}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={toMajorUnitsString(0, sourceCurrency)}
            required
          />
        </Field>

        {isCrossCurrency ? (
          <>
            <Field
              label={`Destination amount (${destAccount?.currency ?? 'destination'})`}
              htmlFor="transfer-dest-amount"
            >
              <Input
                id="transfer-dest-amount"
                type="number"
                min={amountInputStep(destinationCurrency)}
                step={amountInputStep(destinationCurrency)}
                value={destAmount}
                onChange={(event) => setDestAmount(event.target.value)}
                placeholder={toMajorUnitsString(0, destinationCurrency)}
                required
              />
            </Field>
            <Field label="FX rate" htmlFor="transfer-fx">
              <Input
                id="transfer-fx"
                type="text"
                value={fxRate}
                onChange={(event) => setFxRate(event.target.value)}
                placeholder="e.g. 4200.00"
                required
              />
            </Field>
            {amount && destAmount && fxRate ? (
              <p className="muted">
                {formatMoneyMagnitude(toMinorUnits(amount, sourceCurrency), sourceCurrency)}{' '}
                → {formatMoneyMagnitude(
                  toMinorUnits(destAmount, destinationCurrency),
                  destinationCurrency,
                )}{' '}
                at rate {fxRate}
              </p>
            ) : null}
            <Field
              label="Fee"
              hint={`Optional, in ${sourceCurrency || 'the source currency'}`}
              htmlFor="transfer-fee"
            >
              <Input
                id="transfer-fee"
                type="number"
                min="0"
                step={amountInputStep(sourceCurrency)}
                value={fee}
                onChange={(event) => setFee(event.target.value)}
                placeholder="0"
              />
            </Field>
          </>
        ) : null}

        <Field label="Description" hint="Optional" htmlFor="transfer-description">
          <Input
            id="transfer-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <Field label="Date" hint="Optional" htmlFor="transfer-date">
          <Input
            id="transfer-date"
            type="date"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </Field>

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button
          type="submit"
          block
          leftIcon={<ArrowSwap size={16} />}
          disabled={!canSubmit}
        >
          {submitting ? 'Transferring…' : 'Transfer'}
        </Button>
      </div>
    </form>
  )
}
