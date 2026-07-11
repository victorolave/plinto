'use client'

import { type FormEvent, useEffect, useState } from 'react'
import type { Account } from '../../accounts/services/accounts'
import { createTransfer } from '../services/transactions'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { ArrowSwap } from '../../../components/ui/icons'
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
  const [feeMinor, setFeeMinor] = useState('')
  const [description, setDescription] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sourceAccount = accounts.find((a) => a.id === sourceAccountId)
  const destAccount = accounts.find((a) => a.id === destAccountId)
  const isCrossCurrency =
    sourceAccount && destAccount && sourceAccount.currency !== destAccount.currency

  useEffect(() => {
    if (!isCrossCurrency) {
      setDestAmount('')
      setFxRate('')
      setFeeMinor('')
    }
  }, [isCrossCurrency])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const parsedAmount = parseFloat(amount)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero')
      return
    }
    if (!sourceAccountId || !destAccountId) {
      setError('Select both source and destination accounts')
      return
    }
    if (sourceAccountId === destAccountId) {
      setError('Source and destination accounts must differ')
      return
    }

    const sourceAmountMinor = Math.round(parsedAmount * 100)
    let destinationAmountMinor: number | undefined
    let fxRateValue: string | undefined

    if (isCrossCurrency) {
      const parsedDestAmount = parseFloat(destAmount)
      if (Number.isNaN(parsedDestAmount) || parsedDestAmount <= 0) {
        setError('Enter a destination amount greater than zero')
        return
      }
      const fxRateTrimmed = fxRate.trim()
      if (!fxRateTrimmed || !/^\d{1,12}(\.\d{1,8})?$/.test(fxRateTrimmed)) {
        setError('Enter a valid FX rate (e.g. 4200.00)')
        return
      }
      destinationAmountMinor = Math.round(parsedDestAmount * 100)
      fxRateValue = fxRateTrimmed
    }

    const parsedFee = feeMinor.trim() ? parseInt(feeMinor, 10) : undefined
    const fee =
      parsedFee !== undefined && !Number.isNaN(parsedFee) && parsedFee >= 0
        ? parsedFee
        : undefined

    setSubmitting(true)
    setError(null)

    try {
      const trimmedDescription = description.trim()
      await createTransfer({
        sourceAccountId,
        destinationAccountId: destAccountId,
        sourceAmountMinor,
        destinationAmountMinor,
        fxRate: fxRateValue,
        feeMinor: fee,
        description: trimmedDescription || undefined,
        occurredAt: toOccurredAtIso(occurredAt),
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transfer')
    } finally {
      setSubmitting(false)
    }
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
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
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
                min="0.01"
                step="0.01"
                value={destAmount}
                onChange={(event) => setDestAmount(event.target.value)}
                placeholder="0.00"
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
                {parseFloat(amount).toFixed(2)} {sourceAccount?.currency} →{' '}
                {parseFloat(destAmount).toFixed(2)} {destAccount?.currency} at rate{' '}
                {fxRate}
              </p>
            ) : null}
            <Field label="Fee" hint="Optional, in minor units" htmlFor="transfer-fee">
              <Input
                id="transfer-fee"
                type="number"
                min="0"
                step="1"
                value={feeMinor}
                onChange={(event) => setFeeMinor(event.target.value)}
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
