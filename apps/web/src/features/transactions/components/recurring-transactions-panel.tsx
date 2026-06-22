'use client'

import { type FormEvent, useEffect, useState } from 'react'
import type { Account } from '../../accounts/services/accounts'
import type { TransactionType } from '../services/transactions'
import {
  RecurringTransactionRule,
  createRecurringTransactionRule,
  listRecurringTransactionRules,
} from '../services/recurring-transactions'

const recurringTypeOptions: Array<{ value: TransactionType; label: string }> = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

export function RecurringTransactionsPanel({ accounts }: { accounts: Account[] }) {
  const [rules, setRules] = useState<RecurringTransactionRule[]>([])
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id)
    }
  }, [accountId, accounts])

  const loadRules = async () => {
    const response = await listRecurringTransactionRules()
    setRules(response.data.rules)
  }

  useEffect(() => {
    const run = async () => {
      try {
        await loadRules()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recurring rules')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const parsedAmount = parseFloat(amount)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero')
      return
    }

    const parsedDay = parseInt(dayOfMonth, 10)
    if (Number.isNaN(parsedDay) || parsedDay < 1 || parsedDay > 28) {
      setError('Choose a day from 1 to 28')
      return
    }

    if (!startDate) {
      setError('Choose a start date')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await createRecurringTransactionRule({
        name: name.trim(),
        accountId,
        type,
        amountMinor: Math.round(parsedAmount * 100),
        dayOfMonth: parsedDay,
        startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
      })
      setName('')
      setAmount('')
      setDayOfMonth('1')
      setStartDate('')
      await loadRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recurring rule')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card stack">
      <h2>Monthly recurring transactions</h2>
      <p className="muted">Create monthly income or expense rules. Transactions are created by the automatic executor when due.</p>
      <form onSubmit={handleSubmit} className="stack">
        <label className="label">
          Name
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="label">
          Account
          <select className="input" value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>
            ))}
          </select>
        </label>
        <label className="label">
          Type
          <select className="input" value={type} onChange={(event) => setType(event.target.value as TransactionType)}>
            {recurringTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="label">
          Amount
          <input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </label>
        <label className="label">
          Day of month (1-28)
          <input className="input" type="number" min="1" max="28" step="1" value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} required />
        </label>
        <label className="label">
          Start date
          <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="button" disabled={submitting || !accountId}>{submitting ? 'Saving...' : 'Create monthly rule'}</button>
      </form>
      {loading ? <p className="muted">Loading recurring rules...</p> : null}
      {!loading && rules.length === 0 ? <p className="muted">No recurring rules yet.</p> : null}
      {rules.map((rule) => (
        <article key={rule.id} className="list-item">
          <div>
            <strong>{rule.name}</strong>
            <p className="muted">{rule.currency} {(rule.amountMinor / 100).toFixed(2)} · day {rule.dayOfMonth} · {rule.active ? 'active' : 'inactive'}</p>
          </div>
        </article>
      ))}
    </div>
  )
}
