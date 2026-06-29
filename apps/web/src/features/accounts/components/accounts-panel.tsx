'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Account,
  AccountType,
  createAccount,
  listAccounts,
} from '../services/accounts'
import {
  listBalances,
  type AccountBalance,
} from '../../transactions/services/transactions'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { Amount, CurrencyTag } from '../../../components/ui/amount'
import { Modal } from '../../../components/ui/modal'
import { Plus, accountTypeIcon } from '../../../components/ui/icons'

const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit', label: 'Credit' },
  { value: 'savings', label: 'Savings' },
]

export function AccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [currency, setCurrency] = useState('COP')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const loadAccounts = async () => {
    const [accountsRes, balancesRes] = await Promise.all([listAccounts(), listBalances()])
    setAccounts(accountsRes.data.accounts)
    setBalances(balancesRes.data.balances)
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

  const balanceByAccount = useMemo(
    () => new Map(balances.map((b) => [b.accountId, b])),
    [balances],
  )

  const groups = useMemo(() => {
    const map = new Map<string, Account[]>()
    for (const account of accounts) {
      const list = map.get(account.currency) ?? []
      list.push(account)
      map.set(account.currency, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [accounts])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await createAccount({ name, type, currency: currency.trim().toUpperCase() })
      setName('')
      setType('bank')
      setCurrency('COP')
      setOpen(false)
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      {loading ? <p className="muted">Loading accounts…</p> : null}

      {!loading && accounts.length === 0 ? (
        <Card>
          <div className="empty-state">
            <strong style={{ color: 'var(--text-strong)' }}>No accounts yet</strong>
            <p className="muted">
              Each account keeps one currency. Add your first to start tracking.
            </p>
            <Button leftIcon={<Plus size={18} />} onClick={() => setOpen(true)}>
              Add account
            </Button>
          </div>
        </Card>
      ) : null}

      {groups.map(([groupCurrency, groupAccounts]) => {
        const total = groupAccounts.reduce(
          (sum, account) => sum + (balanceByAccount.get(account.id)?.balanceMinor ?? 0),
          0,
        )
        return (
          <section key={groupCurrency}>
            <div className="section-head">
              <CurrencyTag currency={groupCurrency} />
              <h2 className="card-title">
                {groupAccounts.length} account{groupAccounts.length > 1 ? 's' : ''}
              </h2>
              <div className="section-total">
                <span className="plinto-eyebrow">Total in {groupCurrency}</span>
                <Amount minor={total} currency={groupCurrency} size="lg" />
              </div>
            </div>

            <div className="account-grid">
              {groupAccounts.map((account) => {
                const AccountIcon = accountTypeIcon[account.type]
                const balance = balanceByAccount.get(account.id)
                return (
                  <div key={account.id} className="account-card">
                    <div className="account-card-top">
                      <span className="account-icon">
                        <AccountIcon size={18} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="account-name">{account.name}</div>
                        <div className="account-meta">
                          {account.type} · {account.currency}
                        </div>
                      </div>
                    </div>
                    <Amount
                      minor={balance?.balanceMinor ?? 0}
                      currency={account.currency}
                      size="lg"
                    />
                  </div>
                )
              })}

              <button type="button" className="account-add" onClick={() => setOpen(true)}>
                <Plus size={22} />
                Add account
              </button>
            </div>
          </section>
        )
      })}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add account"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-account-form" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create account'}
            </Button>
          </>
        }
      >
        <form id="add-account-form" onSubmit={handleSubmit} className="stack">
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

            <Field label="Currency" htmlFor="account-currency">
              <Input
                id="account-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                maxLength={3}
                required
              />
            </Field>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
        </form>
      </Modal>
    </div>
  )
}
