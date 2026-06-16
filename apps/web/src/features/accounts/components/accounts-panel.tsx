'use client'

import { type FormEvent, useEffect, useState } from 'react'
import {
  Account,
  AccountType,
  createAccount,
  listAccounts,
} from '../services/accounts'

const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit', label: 'Credit' },
  { value: 'savings', label: 'Savings' },
]

export function AccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [currency, setCurrency] = useState('COP')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAccounts = async () => {
    const response = await listAccounts()
    setAccounts(response.data.accounts)
  }

  useEffect(() => {
    const run = async () => {
      try {
        await loadAccounts()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load accounts')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await createAccount({
        name,
        type,
        currency: currency.trim().toUpperCase(),
      })
      setName('')
      setType('bank')
      setCurrency('COP')
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="stack">
      <div>
        <h1>Accounts</h1>
        <p className="muted">
          Create the financial accounts for this household. Each account keeps
          one currency.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card stack">
        <h2>Create account</h2>
        <label className="label">
          Account name
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>

        <label className="label">
          Account type
          <select
            className="input"
            value={type}
            onChange={(event) => setType(event.target.value as AccountType)}
          >
            {accountTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          Currency
          <input
            className="input"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            maxLength={3}
            required
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create account'}
        </button>
      </form>

      <div className="card stack">
        <h2>Your accounts</h2>
        {loading ? <p className="muted">Loading accounts...</p> : null}
        {!loading && accounts.length === 0 ? (
          <p className="muted">No accounts yet. Create your first account.</p>
        ) : null}
        {accounts.length > 0 ? (
          <div className="stack">
            {accounts.map((account) => (
              <article key={account.id} className="list-item">
                <div>
                  <strong>{account.name}</strong>
                  <p className="muted">
                    {account.type} · {account.currency}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
