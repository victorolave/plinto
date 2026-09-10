'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useFormattingLocale } from '../../../i18n/formatting'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import { useValidationMessage } from '../../../lib/api/use-validation-message'
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
  const t = useTranslations('debts.form')
  const tCommon = useTranslations('common')
  const toErrorMessage = useErrorMessage()
  const toValidationMessage = useValidationMessage()
  const locale = useFormattingLocale()
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
  const error = validationError ?? toErrorMessage(createMutation.error)

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
      setValidationError(toValidationMessage(result.error.issues[0]) ?? t('invalid'))
      return
    }

    setValidationError(null)
    createMutation.mutate(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        {liabilities.length === 0 ? (
          <p className="muted">{t('needLiabilityAccount')}</p>
        ) : null}

        <Field label={t('lender')} htmlFor="debt-account">
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

        <Field label={t('whatYouBought')} htmlFor="debt-name">
          <Input
            id="debt-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('namePlaceholder')}
            required
          />
        </Field>

        <Field
          label={t('totalToRepay')}
          hint={t('totalToRepayHint')}
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
          <Field label={t('eachInstallment')} htmlFor="debt-installment">
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
          <Field label={t('howMany')} htmlFor="debt-count">
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

        <Field label={t('firstDue')} htmlFor="debt-first-due">
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
            {t.rich('lastInstallmentNote', {
              amount: formatMoneyMagnitude(lastInstallmentMinor, currency, locale),
              strong: (chunks) => (
                <strong style={{ color: 'var(--text-strong)' }}>{chunks}</strong>
              ),
            })}
          </p>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting || liabilities.length === 0}>
          {submitting ? tCommon('saving') : t('recordPurchase')}
        </Button>
      </div>
    </form>
  )
}
