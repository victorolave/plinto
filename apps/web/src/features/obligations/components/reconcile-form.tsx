'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toMajorUnitsString, toMinorUnits } from '@plinto/shared'
import { useFormattingLocale } from '../../../i18n/formatting'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import type { Account } from '../../accounts/services/accounts'
import type { Category } from '../../categories/services/categories'
import { CategorySelect } from '../../categories/components/category-select'
import type { Transaction } from '../../transactions/services/transactions'
import { toOccurredAtIso } from '../../transactions/lib/transaction-input'
import type { ObligationInstance } from '../services/obligations'
import { reconcileObligation } from '../services/obligations'
import { Button } from '../../../components/ui/button'
import { Field, Input, SegmentedControl, Select } from '../../../components/ui/field'
import { amountInputStep, formatMoneyMagnitude } from '../../../components/ui/amount'

export interface ReconcileFormProps {
  obligation: ObligationInstance
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  onSaved: () => void | Promise<void>
}

/** Record the payment now, or point at one already in the ledger. */
type Mode = 'record' | 'link'

/**
 * Settles an obligation, either by recording the payment or by linking a
 * movement already in the ledger.
 *
 * Linking used to be the only way, which made paying a bill three steps: leave
 * the board, record the expense, come back and find it in a picker. Paying and
 * writing it down are one act, so recording is the default and linking is what
 * remains for the movement that was already there.
 *
 * Both modes only offer what the server would actually accept — accounts and
 * expenses in the obligation's own currency — so nobody is walked into a 409.
 * The server still enforces every rule; this only avoids offering choices that
 * are certain to be rejected.
 */
export function ReconcileForm({
  obligation,
  transactions,
  accounts,
  categories,
  onSaved,
}: ReconcileFormProps) {
  const t = useTranslations('obligations.reconcile')
  const toErrorMessage = useErrorMessage()
  const locale = useFormattingLocale()

  const eligibleAccounts = useMemo(
    () => accounts.filter((account) => account.currency === obligation.currency),
    [accounts, obligation.currency],
  )

  const eligibleTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.type === 'expense' &&
          transaction.currency === obligation.currency,
      ),
    [transactions, obligation.currency],
  )

  const [mode, setMode] = useState<Mode>('record')
  const [accountId, setAccountId] = useState(eligibleAccounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  // What is still owed, because that is what recording a payment almost always
  // means. Editable, since a household can pay a bill in parts.
  const [amount, setAmount] = useState(() =>
    toMajorUnitsString(
      Math.max(obligation.expectedAmountMinor - obligation.paidAmountMinor, 0),
      obligation.currency,
    ),
  )
  const [transactionId, setTransactionId] = useState(eligibleTransactions[0]?.id ?? '')

  const reconcileMutation = useMutation({
    mutationFn: (payload: Parameters<typeof reconcileObligation>[1]) =>
      reconcileObligation(obligation.id, payload),
    onSuccess: () => {
      void onSaved()
    },
  })

  const error = toErrorMessage(reconcileMutation.error)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (mode === 'link') {
      if (!transactionId) return
      reconcileMutation.mutate({ transactionId })
      return
    }

    if (!accountId) return
    reconcileMutation.mutate({
      transaction: {
        accountId,
        amountMinor: toMinorUnits(amount, obligation.currency),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(occurredAt ? { occurredAt: toOccurredAtIso(occurredAt) } : {}),
        ...(categoryId !== null ? { categoryId } : {}),
      },
    })
  }

  const canRecord = eligibleAccounts.length > 0
  const canLink = eligibleTransactions.length > 0
  const submittable = mode === 'record' ? canRecord : canLink

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <p className="muted">
          {t.rich('expected', {
            amount: formatMoneyMagnitude(
              obligation.expectedAmountMinor,
              obligation.currency,
              locale,
            ),
            strong: (chunks) => (
              <strong style={{ color: 'var(--text-strong)' }}>{chunks}</strong>
            ),
          })}
          {obligation.paidAmountMinor > 0
            ? ` · ${t('alreadySettled', {
                amount: formatMoneyMagnitude(
                  obligation.paidAmountMinor,
                  obligation.currency,
                  locale,
                ),
              })}`
            : null}
        </p>

        <Field label={t('mode')}>
          <SegmentedControl<Mode>
            options={[
              { value: 'record', label: t('modeRecord') },
              { value: 'link', label: t('modeLink') },
            ]}
            value={mode}
            onChange={setMode}
          />
        </Field>

        {mode === 'record' ? (
          canRecord ? (
            <>
              <Field
                label={t('account')}
                hint={t('accountHint', { currency: obligation.currency })}
                htmlFor="reconcile-account"
              >
                <Select
                  id="reconcile-account"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  required
                >
                  {eligibleAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('amount')} htmlFor="reconcile-amount">
                <Input
                  id="reconcile-amount"
                  type="number"
                  min={amountInputStep(obligation.currency)}
                  step={amountInputStep(obligation.currency)}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </Field>

              <Field
                label={t('category')}
                hint={t('optional')}
                htmlFor="reconcile-category"
              >
                <CategorySelect
                  type="expense"
                  value={categoryId}
                  onChange={setCategoryId}
                  categories={categories}
                />
              </Field>

              <Field
                label={t('description')}
                hint={t('optional')}
                htmlFor="reconcile-description"
              >
                <Input
                  id="reconcile-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                />
              </Field>

              <Field label={t('date')} hint={t('optional')} htmlFor="reconcile-date">
                <Input
                  id="reconcile-date"
                  type="date"
                  value={occurredAt}
                  onChange={(event) => setOccurredAt(event.target.value)}
                />
              </Field>
            </>
          ) : (
            <p className="muted">
              {t('noEligibleAccount', { currency: obligation.currency })}
            </p>
          )
        ) : canLink ? (
          <Field
            label={t('transaction')}
            hint={t('transactionHint')}
            htmlFor="reconcile-transaction"
          >
            <Select
              id="reconcile-transaction"
              value={transactionId}
              onChange={(event) => setTransactionId(event.target.value)}
              required
            >
              {eligibleTransactions.map((transaction) => (
                <option key={transaction.id} value={transaction.id}>
                  {formatMoneyMagnitude(
                    transaction.amountMinor,
                    transaction.currency,
                    locale,
                  )}{' '}
                  · {transaction.description || t('noDescription')} ·{' '}
                  {transaction.occurredAt.slice(0, 10)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="muted">
            {t('noEligibleExpense', { currency: obligation.currency })}
          </p>
        )}

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      {submittable ? (
        <div className="drawer-form-actions">
          <Button type="submit" block disabled={reconcileMutation.isPending}>
            {mode === 'record'
              ? reconcileMutation.isPending
                ? t('recording')
                : t('recordAndSettle')
              : reconcileMutation.isPending
                ? t('linking')
                : t('markSettled')}
          </Button>
        </div>
      ) : null}
    </form>
  )
}
