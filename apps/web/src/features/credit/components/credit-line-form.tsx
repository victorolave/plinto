'use client'

import { type FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import { useValidationMessage } from '../../../lib/api/use-validation-message'
import {
  CreateCreditLineSchema,
  UpdateCreditLineSchema,
  toMajorUnitsString,
  toMinorUnits,
} from '@plinto/shared'
import { createCreditLine, updateCreditLine, type CreditLine } from '../services/credit'
import { queryKeys } from '../../../lib/api/query-keys'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { amountInputStep } from '../../../components/ui/amount'

export interface CreditLineFormProps {
  currencies: string[]
  /** When present the form edits that line instead of adding one. */
  line?: CreditLine
  onSaved: () => void | Promise<void>
}

/**
 * Recording a card or a rotating line, or fixing one already recorded.
 *
 * Three fields, and none of them is a billing day. What a line bills and when
 * is carried by each statement, because the lender decides it and can change
 * it — some of these offer a choice between monthly and biweekly. Asking here
 * would be storing a second opinion about a fact the statements already state.
 *
 * The ceiling is editable for two reasons that both happen: issuers move
 * limits, and somebody setting a line up may not have the real figure to hand
 * and needs to put a working one in. A number that cannot be corrected is a
 * number its owner is stuck with.
 */
export function CreditLineForm({ currencies, line, onSaved }: CreditLineFormProps) {
  const t = useTranslations('credit.form')
  const tCommon = useTranslations('common')
  const toErrorMessage = useErrorMessage()
  const toValidationMessage = useValidationMessage()
  const queryClient = useQueryClient()
  const editing = line !== undefined

  const [name, setName] = useState(line?.name ?? '')
  const [limit, setLimit] = useState(
    line ? toMajorUnitsString(line.limitMinor, line.currency) : '',
  )
  const [currency, setCurrency] = useState(line?.currency ?? currencies[0] ?? 'COP')
  const [validationError, setValidationError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: (input: { name: string; limitMinor: number; currency: string }) =>
      editing
        ? updateCreditLine(line.id, { name: input.name, limitMinor: input.limitMinor })
        : createCreditLine(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.creditLines })
      void queryClient.invalidateQueries({ queryKey: queryKeys.creditSummary })
      void onSaved()
    },
  })

  const submitting = saveMutation.isPending
  const error = validationError ?? toErrorMessage(saveMutation.error)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const payload = {
      name: name.trim(),
      limitMinor: toMinorUnits(limit, currency),
      currency,
    }

    // The update schema omits the currency, so it is validated out of the
    // payload rather than merely disabled in the form.
    const result = editing
      ? UpdateCreditLineSchema.safeParse({
          name: payload.name,
          limitMinor: payload.limitMinor,
        })
      : CreateCreditLineSchema.safeParse(payload)

    if (!result.success) {
      setValidationError(toValidationMessage(result.error.issues[0]) ?? t('invalid'))
      return
    }

    setValidationError(null)
    saveMutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="drawer-form">
      <div className="stack">
        <Field label={t('name')} htmlFor="credit-name">
          <Input
            id="credit-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('namePlaceholder')}
            required
          />
        </Field>

        <div className="form-grid">
          <Field
            label={t('limit')}
            hint={t('limitHint')}
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
          <Field
            label={t('currency')}
            hint={editing ? t('currencyFixedHint') : undefined}
            htmlFor="credit-currency"
          >
            <Select
              id="credit-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              disabled={editing}
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

        <p className="muted">{editing ? t('editingNote') : t('creatingNote')}</p>

        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="drawer-form-actions">
        <Button type="submit" block disabled={submitting}>
          {submitting
            ? tCommon('saving')
            : editing
              ? t('saveChanges')
              : t('addCreditLine')}
        </Button>
      </div>
    </form>
  )
}
