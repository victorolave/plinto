'use client'

import { type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { listAccounts } from '../../accounts/services/accounts'
import {
  listBalances,
  listTransactions,
  type AccountBalance,
  type Transaction,
} from '../../transactions/services/transactions'
import { queryKeys } from '../../../lib/api/query-keys'
import { Card, CardHeader } from '../../../components/ui/card'
import { StatCard } from '../../../components/ui/stat-card'
import { Amount } from '../../../components/ui/amount'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import {
  Wallet,
  Cart,
  Briefcase,
  ChevronRight,
  accountTypeIcon,
} from '../../../components/ui/icons'
import { SECTION_HREF } from '../../../components/layout/dashboard-nav'
import { useDashboard } from '../../../components/layout/dashboard-context'

interface CurrencyTotal {
  currency: string
  totalMinor: number
}

function sumByCurrency(balances: AccountBalance[]): CurrencyTotal[] {
  const map = new Map<string, number>()
  for (const balance of balances) {
    map.set(balance.currency, (map.get(balance.currency) ?? 0) + balance.balanceMinor)
  }
  return [...map.entries()]
    .map(([currency, totalMinor]) => ({ currency, totalMinor }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

function signedMinor(transaction: Transaction): number {
  return transaction.type === 'income' ? transaction.amountMinor : -transaction.amountMinor
}

function formatUtcDate(occurredAt: string): string {
  if (!occurredAt) return ''
  return new Date(occurredAt).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  })
}

const monthLabel = new Date().toLocaleDateString(undefined, {
  month: 'long',
  year: 'numeric',
})

export function DashboardOverview() {
  const router = useRouter()
  const { activeTenantName: tenantName } = useDashboard()

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: async () => (await listAccounts()).data.accounts,
  })
  const balancesQuery = useQuery({
    queryKey: queryKeys.balances,
    queryFn: async () => (await listBalances()).data.balances,
  })
  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions(),
    queryFn: async () => (await listTransactions()).data.transactions,
  })

  const accounts = accountsQuery.data ?? []
  const balances: AccountBalance[] = balancesQuery.data ?? []
  const transactions: Transaction[] = transactionsQuery.data ?? []
  const loading =
    accountsQuery.isLoading || balancesQuery.isLoading || transactionsQuery.isLoading
  const loadError = accountsQuery.error ?? balancesQuery.error ?? transactionsQuery.error
  const error = loadError instanceof Error ? loadError.message : null

  const totals = sumByCurrency(balances)
  const recent = transactions.slice(0, 6)
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const balanceByAccount = new Map(balances.map((b) => [b.accountId, b]))

  return (
    <div className="page">
      <div className="cluster">
        <span className="plinto-eyebrow">{monthLabel} · balances</span>
        {totals.length > 1 ? (
          <Badge tone="info">Currencies shown separately</Badge>
        ) : null}
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <p className="muted">Loading your household…</p>
      ) : (
        <>
          {totals.length > 0 ? (
            <div className="stat-grid">
              {totals.map((total, index) => (
                <StatCard
                  key={total.currency}
                  label={`Net balance (${total.currency})`}
                  valueMinor={total.totalMinor}
                  currency={total.currency}
                  accent={index === 0}
                  deltaLabel={
                    index === 0 ? 'across all accounts' : `${total.currency} accounts`
                  }
                  icon={<Wallet size={16} />}
                />
              ))}
            </div>
          ) : (
            <Card>
              <div className="empty-state">
                <strong style={{ color: 'var(--text-strong)' }}>
                  No balances yet
                </strong>
                <p className="muted">
                  Add an account and record your first transaction to see your
                  household balance here.
                </p>
                <Button onClick={() => router.push(SECTION_HREF.accounts)}>
                  Add account
                </Button>
              </div>
            </Card>
          )}

          <div
            className="panel-grid"
            style={
              {
                '--panel-cols': 'minmax(0, 1.6fr) minmax(0, 1fr)',
                gap: 'var(--space-5)',
              } as CSSProperties
            }
          >
            <Card flush>
              <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}>
                <CardHeader
                  title="Recent activity"
                  subtitle={tenantName ? `${tenantName} · all members` : 'All members'}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      rightIcon={<ChevronRight size={15} />}
                      onClick={() => router.push(SECTION_HREF.transactions)}
                    >
                      See all
                    </Button>
                  }
                />
              </div>
              <div style={{ padding: '0 var(--space-4) var(--space-3)' }}>
                {recent.length === 0 ? (
                  <div className="empty-state">
                    <p className="muted">
                      No transactions yet. Add your first one to start tracking.
                    </p>
                  </div>
                ) : (
                  recent.map((transaction) => {
                    const income = transaction.type === 'income'
                    const RowIcon = income ? Briefcase : Cart
                    const account = accountById.get(transaction.accountId)
                    return (
                      <div key={transaction.id} className="tx-row">
                        <span className="tx-icon">
                          <RowIcon size={18} />
                        </span>
                        <div className="tx-main">
                          <div className="tx-title">
                            {transaction.description || (income ? 'Income' : 'Expense')}
                          </div>
                          <div className="tx-meta">
                            <span>{formatUtcDate(transaction.occurredAt)}</span>
                            {account ? (
                              <>
                                <span>·</span>
                                <span>{account.name}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="tx-right">
                          <Amount
                            minor={signedMinor(transaction)}
                            currency={transaction.currency}
                            size="sm"
                            colorize
                            showSign
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Accounts"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(SECTION_HREF.accounts)}
                  >
                    Manage
                  </Button>
                }
              />
              {accounts.length === 0 ? (
                <p className="muted">No accounts yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {accounts.slice(0, 4).map((account) => {
                    const AccountIcon = accountTypeIcon[account.type]
                    const balance = balanceByAccount.get(account.id)
                    return (
                      <div key={account.id} className="data-row">
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                            minWidth: 0,
                          }}
                        >
                          <span className="account-icon" style={{ width: 34, height: 34 }}>
                            <AccountIcon size={17} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div className="account-name">{account.name}</div>
                            <div className="account-meta">
                              {account.type} · {account.currency}
                            </div>
                          </div>
                        </div>
                        {balance ? (
                          <Amount
                            minor={balance.balanceMinor}
                            currency={balance.currency}
                            size="sm"
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
