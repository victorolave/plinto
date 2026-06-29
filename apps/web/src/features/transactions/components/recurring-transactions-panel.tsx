'use client'

import { type CSSProperties, type FormEvent, useEffect, useState } from 'react'
import type { Account } from '../../accounts/services/accounts'
import type { TransactionType } from '../services/transactions'
import {
  RecurringTransactionRule,
  createRecurringTransactionRule,
  listRecurringTransactionRules,
} from '../services/recurring-transactions'
import { Card, CardHeader } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { Amount } from '../../../components/ui/amount'
import { Badge } from '../../../components/ui/badge'
import { Repeat } from '../../../components/ui/icons'

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

  const accountById = new Map(accounts.map((a) => [a.id, a]))

  return (
    <Card flush>
      <div style={{ padding: 'var(--space-6) var(--space-6) 0' }}>
        <CardHeader
          title="Monthly recurring transactions"
          subtitle="The automatic executor creates each transaction when it's due."
        />
      </div>
      <div
        className="panel-grid"
        style={
          {
            '--panel-cols': 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 'var(--space-6)',
            padding: '0 var(--space-6) var(--space-6)',
          } as CSSProperties
        }
      >
        <form onSubmit={handleSubmit} className="stack">
          <Field label="Name" htmlFor="recurring-name">
            <Input
              id="recurring-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Rent"
              required
            />
          </Field>

          <div className="form-grid">
            <Field label="Account" htmlFor="recurring-account">
              <Select
                id="recurring-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                required
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type" htmlFor="recurring-type">
              <Select
                id="recurring-type"
                value={type}
                onChange={(event) => setType(event.target.value as TransactionType)}
              >
                {recurringTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="form-grid">
            <Field label="Amount" htmlFor="recurring-amount">
              <Input
                id="recurring-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
              />
            </Field>
            <Field label="Day of month" hint="1–28" htmlFor="recurring-day">
              <Input
                id="recurring-day"
                type="number"
                min="1"
                max="28"
                step="1"
                value={dayOfMonth}
                onChange={(event) => setDayOfMonth(event.target.value)}
                required
              />
            </Field>
          </div>

          <Field label="Start date" htmlFor="recurring-start">
            <Input
              id="recurring-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </Field>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="inline-actions">
            <Button type="submit" leftIcon={<Repeat size={16} />} disabled={submitting || !accountId}>
              {submitting ? 'Saving…' : 'Create monthly rule'}
            </Button>
          </div>
        </form>

        <div className="data-list">
          {loading ? <p className="muted">Loading recurring rules…</p> : null}
          {!loading && rules.length === 0 ? (
            <p className="muted">No recurring rules yet.</p>
          ) : null}
          {rules.map((rule) => {
            const account = accountById.get(rule.accountId)
            const currency = rule.currency ?? account?.currency ?? ''
            return (
              <div key={rule.id} className="data-row">
                <div style={{ minWidth: 0 }}>
                  <div className="account-name">{rule.name}</div>
                  <div className="account-meta" style={{ textTransform: 'none' }}>
                    Day {rule.dayOfMonth} · {account?.name ?? 'account'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  {currency ? (
                    <Amount minor={rule.amountMinor} currency={currency} size="sm" />
                  ) : null}
                  <Badge tone={rule.active ? 'success' : 'neutral'}>
                    {rule.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
