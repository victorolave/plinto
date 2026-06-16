'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { listAccounts } from '../../accounts/services/accounts'
import type { Account } from '../../accounts/services/accounts'
import {
  AccountBalance,
  Transaction,
  TransactionType,
  createTransaction,
  listBalances,
  listTransactions,
} from '../services/transactions'

const transactionTypeOptions: Array<{ value: TransactionType; label: string }> = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

export function TransactionsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [type, setType] = useState<TransactionType>('income')
  // Amount is collected in major units (e.g. 100.50 COP) and converted to minor
  // units via Math.round(amount * 100). This ×100 assumption is an MVP simplification
  // pending a per-currency minor-units table (ADR 0004).
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    const [balancesRes, transactionsRes] = await Promise.all([
      listBalances(),
      listTransactions(),
    ])
    setBalances(balancesRes.data.balances)
    setTransactions(transactionsRes.data.transactions)
  }

  useEffect(() => {
    const run = async () => {
      try {
        const [accountsRes, balancesRes, transactionsRes] = await Promise.all([
          listAccounts(),
          listBalances(),
          listTransactions(),
        ])
        setAccounts(accountsRes.data.accounts)
        setBalances(balancesRes.data.balances)
        setTransactions(transactionsRes.data.transactions)
        if (accountsRes.data.accounts.length > 0) {
          setSelectedAccountId(accountsRes.data.accounts[0].id)
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load transactions',
        )
      } finally {
        setLoading(false)
      }
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const parsedAmount = parseFloat(amount)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const amountMinor = Math.round(parsedAmount * 100)
      await createTransaction({
        accountId: selectedAccountId,
        type,
        amountMinor,
        description: description.trim() || undefined,
      })
      setAmount('')
      setDescription('')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create transaction',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="stack">
      <div>
        <h1>Transactions</h1>
        <p className="muted">
          Record income and expenses for your accounts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card stack">
        <h2>Record transaction</h2>
        <label className="label">
          Account
          <select
            className="input"
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.target.value)}
            required
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Type
          <select
            className="input"
            value={type}
            onChange={(event) => setType(event.target.value as TransactionType)}
          >
            {transactionTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Amount
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <label className="label">
          Description (optional)
          <input
            className="input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Recording...' : 'Record transaction'}
        </button>
      </form>

      <div className="card stack">
        <h2>Balances</h2>
        {loading ? <p className="muted">Loading balances...</p> : null}
        {!loading && balances.length === 0 ? (
          <p className="muted">No balances yet.</p>
        ) : null}
        {balances.length > 0 ? (
          <div className="stack">
            {balances.map((balance) => (
              <article key={balance.accountId} className="list-item">
                <div>
                  <strong>{balance.accountName}</strong>
                  <p className="muted">
                    {balance.currency}{' '}
                    {(balance.balanceMinor / 100).toFixed(2)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card stack">
        <h2>Transaction history</h2>
        {loading ? <p className="muted">Loading transactions...</p> : null}
        {!loading && transactions.length === 0 ? (
          <p className="muted">No transactions yet. Record your first transaction.</p>
        ) : null}
        {transactions.length > 0 ? (
          <div className="stack">
            {transactions.map((transaction) => (
              <article key={transaction.id} className="list-item">
                <div>
                  <strong>
                    {transaction.type === 'income' ? '+' : '-'}{' '}
                    {transaction.currency}{' '}
                    {(transaction.amountMinor / 100).toFixed(2)}
                  </strong>
                  {transaction.description ? (
                    <p className="muted">{transaction.description}</p>
                  ) : null}
                  <p className="muted">
                    {new Date(transaction.occurredAt).toLocaleDateString()}
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
