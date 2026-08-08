'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreateDebtScheduleSchema,
  isLiabilityAccountType,
  toMinorUnits,
} from '@plinto/shared'
import type { Account } from '../../accounts/services/accounts'
import { createDebt } from '../services/debts'
import { queryKeys } from '../../../lib/api/query-keys'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { amountInputStep, formatMoneyMagnitude } from '../../../components/ui/amount'

export interface DebtFormProps {
  accounts: Account[]
  onSaved: () => void | Promise<void>
}

/**
 * Recording a purchase financed in fixed installments — one row of the `ADDI`
 * sheet.
 *
 * The form asks for what the lender quoted: a total to repay, a number of
 * installments, and what each one charges. It does not ask for a rate, because
 * nobody is told one — interest is recorded, not calculated (PRD-007).
 */
export function DebtForm({ accounts, onSaved }: DebtFormProps) {
  const queryClient = useQueryClient()

  const liabilities = useMemo(
    () => accounts.filter((account) => isLiabilityAccountType(account.type)),
    [accounts],
  )

  const [accountId, setAccountId] = useState(liabilities[0]?.id ?? '')
  const [name, setName] = useState('')
  const [principal, setPrincipal] = useState('')
  const [installment, setInstallment] = useState('')
  const [count, setCount] = useState('3')
  const [firstDueDate, setFirstDueDate] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const account = liabilities.find((candidate) => candidate.id === accountId)
  const currency = account?.currency ?? ''

  const principalMinor = toMinorUnits(principal, currency)
  const installmentMinor = toMinorUnits(installment, currency)
  const installmentCount = Number.parseInt(count, 10)

  /**
   * What the last installment will actually charge. Shown because lenders quote
   * figures that do not multiply out, and a person entering them deserves to
   * see where the difference lands rather than discover it three months in.
   */
  const lastInstallmentMinor =
    Number.isFinite(principalMinor) &&
    Number.isFinite(installmentMinor) &&
    Number.isFinite(installmentCount) &&
    installmentCount > 0
      ? principalMinor - installmentMinor * (installmentCount - 1)
      : null

  const lastDiffers =
    lastInstallmentMinor !== null &&
    lastInstallmentMinor > 0 &&
    lastInstallmentMinor !== installmentMinor

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createDebt>[0]) => createDebt(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.debts })
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
      accountId,
      name: name.trim(),
      principalMinor,
      installmentMinor,
      installmentCount,
      firstDueDate: firstDueDate ? `${firstDueDate}T00:00:00.000Z` : '',
    }

    const result = CreateDebtScheduleSchema.safeParse(payload)
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Invalid schedule')
      return
    }

    setValidationError(null)
    createMutation.mutate(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        {liabilities.length === 0 ? (
          <p className="muted">
            You need a debt or credit account first — that is what the
            installments pay down.
          </p>
        ) : null}

        <Field label="Lender" htmlFor="debt-account">
          <Select
            id="debt-account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            required
          >
            {liabilities.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} ({candidate.currency})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="What you bought" htmlFor="debt-name">
          <Input
            id="debt-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Nevera"
            required
          />
        </Field>

        <Field
          label="Total to repay"
          hint="Interest included — what the lender says you will pay in all"
          htmlFor="debt-principal"
        >
          <Input
            id="debt-principal"
            type="number"
            min={amountInputStep(currency)}
            step={amountInputStep(currency)}
            value={principal}
            onChange={(event) => setPrincipal(event.target.value)}
            required
          />
        </Field>

        <div className="form-grid">
          <Field label="Each installment" htmlFor="debt-installment">
            <Input
              id="debt-installment"
              type="number"
              min={amountInputStep(currency)}
              step={amountInputStep(currency)}
              value={installment}
              onChange={(event) => setInstallment(event.target.value)}
              required
            />
          </Field>
          <Field label="How many" htmlFor="debt-count">
            <Input
              id="debt-count"
              type="number"
              min="1"
              max="120"
              step="1"
              value={count}
              onChange={(event) => setCount(event.target.value)}
              required
            />
          </Field>
        </div>

        <Field label="First installment due" htmlFor="debt-first-due">
          <Input
            id="debt-first-due"
            type="date"
            value={firstDueDate}
            onChange={(event) => setFirstDueDate(event.target.value)}
            required
          />
        </Field>

        {lastDiffers ? (
          <p className="muted">
            The last installment will charge{' '}
            <strong style={{ color: 'var(--text-strong)' }}>
              {formatMoneyMagnitude(lastInstallmentMinor, currency)}
            </strong>
            , so the plan adds up to exactly what you owe.
          </p>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting || liabilities.length === 0}>
          {submitting ? 'Saving…' : 'Record purchase'}
        </Button>
      </div>
    </form>
  )
}
