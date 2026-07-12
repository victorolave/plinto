'use client'

import { type FormEvent, useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { CreateAccountSchema, UpdateAccountSchema } from '@plinto/shared'
import { type Account, type AccountType, createAccount, updateAccount } from '../services/accounts'
import { Field, Input, Select } from '../../../components/ui/field'

const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit', label: 'Credit' },
  { value: 'savings', label: 'Savings' },
]

export interface AccountFormProps {
  /** When set, edits this account; otherwise creates a new one. */
  editing: Account | null
  /** Owned by the parent panel so it can invalidate the shared accounts/balances
   * cache on success — this component only validates fields and calls `.mutate`. */
  createMutation: UseMutationResult<
    Awaited<ReturnType<typeof createAccount>>,
    Error,
    { name: string; type: AccountType; currency: string }
  >
  updateMutation: UseMutationResult<
    Awaited<ReturnType<typeof updateAccount>>,
    Error,
    { id: string; input: { name: string; type: AccountType } }
  >
}

/**
 * Create/edit account fields. Submitted via the external `account-form` id
 * button in the parent Modal's footer (see AccountsPanel), so this component
 * renders only the `<form>` and its fields — no submit button of its own.
 */
export function AccountForm({ editing, createMutation, updateMutation }: AccountFormProps) {
  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<AccountType>(editing?.type ?? 'bank')
  const [currency, setCurrency] = useState(editing?.currency ?? 'COP')
  const [validationError, setValidationError] = useState<string | null>(null)

  const mutationError = editing ? updateMutation.error : createMutation.error
  const error =
    validationError ?? (mutationError instanceof Error ? mutationError.message : null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (editing) {
      const input = { name, type }
      const result = UpdateAccountSchema.safeParse(input)
      if (!result.success) {
        setValidationError(result.error.issues[0]?.message ?? 'Invalid account')
        return
      }

      setValidationError(null)
      updateMutation.mutate({ id: editing.id, input })
      return
    }

    const input = {
      name,
      type,
      currency: currency.trim().toUpperCase(),
    }
    const result = CreateAccountSchema.safeParse(input)
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Invalid account')
      return
    }

    setValidationError(null)
    createMutation.mutate(input)
  }

  return (
    <form id="account-form" onSubmit={handleSubmit} className="stack">
      <Field label="Account name" htmlFor="account-name">
        <Input
          id="account-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Family checking"
          required
        />
      </Field>

      <div className="form-grid">
        <Field label="Account type" htmlFor="account-type">
          <Select
            id="account-type"
            value={type}
            onChange={(event) => setType(event.target.value as AccountType)}
          >
            {accountTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Currency"
          htmlFor="account-currency"
          hint={editing ? 'Currency cannot change once the account exists.' : undefined}
        >
          <Input
            id="account-currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            maxLength={3}
            required
            disabled={editing !== null}
          />
        </Field>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
    </form>
  )
}
