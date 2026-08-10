'use client'

import { type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useFormattingLocale } from '../../../i18n/formatting'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import { isLiabilityAccountType } from '@plinto/shared'
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
import { Amount, formatMoneyMagnitude } from '../../../components/ui/amount'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import {
  Wallet,
  Cart,
  Briefcase,
  ChevronRight,
  accountTypeIcon,
} from '../../../components/ui/icons'
import { DashboardSkeleton } from './dashboard-skeleton'
import { SECTION_HREF } from '../../../components/layout/dashboard-nav'
import { useDashboard } from '../../../components/layout/dashboard-context'

interface CurrencyTotal {
  currency: string
  /** What the household holds: assets only. */
  totalMinor: number
  /** What it owes, as a positive figure. Zero when it owes nothing. */
  owedMinor: number
}

/**
 * Assets and liabilities are summed apart, deliberately.
 *
 * Adding a debt account into the same figure as a bank account changes what
 * that figure means — from "what we hold" to "what we are worth" — for a
 * household that never asked for the second one. The number on this dashboard
 * answers "do we make it to the end of the month", and net worth does not
 * answer it.
 *
 * Liabilities carry a negative balance, so what is owed is its magnitude.
 */
function sumByCurrency(balances: AccountBalance[]): CurrencyTotal[] {
  const held = new Map<string, number>()
  const owed = new Map<string, number>()

  for (const balance of balances) {
    const bucket = isLiabilityAccountType(balance.accountType) ? owed : held
    const signed = isLiabilityAccountType(balance.accountType)
      ? -balance.balanceMinor
      : balance.balanceMinor
    bucket.set(balance.currency, (bucket.get(balance.currency) ?? 0) + signed)
  }

  const currencies = new Set([...held.keys(), ...owed.keys()])

  return [...currencies]
    .map((currency) => ({
      currency,
      totalMinor: held.get(currency) ?? 0,
      owedMinor: owed.get(currency) ?? 0,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

function signedMinor(transaction: Transaction): number {
  return transaction.type === 'income' ? transaction.amountMinor : -transaction.amountMinor
}

function formatUtcDate(occurredAt: string, locale: string): string {
  if (!occurredAt) return ''
  return new Date(occurredAt).toLocaleDateString(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * This used to be a module-level `const`, formatted with the runtime's own
 * locale and evaluated once at import time — the worst shape of the hydration
 * bug in this codebase. The server module and the browser module each computed
 * their own string, in their own language, and React then found two different
 * month names in the same slot.
 *
 * Taking `locale` as an argument and calling it during render fixes both
 * halves: same language on both sides, and re-evaluated per render so the label
 * is not frozen at whatever moment the module happened to load.
 */
function formatMonthLabel(locale: string): string {
  return new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}

export function DashboardOverview() {
  const t = useTranslations('dashboard')
  const tAccounts = useTranslations('accounts')
  const toErrorMessage = useErrorMessage()
  const locale = useFormattingLocale()
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
    queryKey: queryKeys.recentTransactions,
    queryFn: async () => (await listTransactions({ pageSize: 6 })).data.transactions,
  })

  const accounts = accountsQuery.data ?? []
  const balances: AccountBalance[] = balancesQuery.data ?? []
  const transactions: Transaction[] = transactionsQuery.data ?? []
  const loading =
    accountsQuery.isLoading || balancesQuery.isLoading || transactionsQuery.isLoading
  const error = toErrorMessage(
    accountsQuery.error ?? balancesQuery.error ?? transactionsQuery.error,
  )

  const totals = sumByCurrency(balances)
  const recent = transactions.slice(0, 6)
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const balanceByAccount = new Map(balances.map((b) => [b.accountId, b]))

  return (
    <div className="page">
      <div className="cluster">
        <span className="plinto-eyebrow">
          {t('monthBalances', { month: formatMonthLabel(locale) })}
        </span>
        {totals.length > 1 ? (
          <Badge tone="info">{t('currenciesSeparate')}</Badge>
        ) : null}
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {totals.length > 0 ? (
            <div className="stat-grid">
              {totals.map((total, index) => (
                <StatCard
                  key={total.currency}
                  label={t('available', { currency: total.currency })}
                  valueMinor={total.totalMinor}
                  currency={total.currency}
                  accent={index === 0}
                  deltaLabel={
                    total.owedMinor > 0
                      ? t('owedAmount', {
                          amount: formatMoneyMagnitude(
                            total.owedMinor,
                            total.currency,
                            locale,
                          ),
                        })
                      : index === 0
                        ? t('acrossAllAccounts')
                        : t('currencyAccounts', { currency: total.currency })
                  }
                  icon={<Wallet size={16} />}
                />
              ))}
            </div>
          ) : (
            <Card>
              <div className="empty-state">
                <strong style={{ color: 'var(--text-strong)' }}>
                  {t('noBalances.title')}
                </strong>
                <p className="muted">{t('noBalances.description')}</p>
                <Button onClick={() => router.push(SECTION_HREF.accounts)}>
                  {tAccounts('addAccount')}
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
                  title={t('recentActivity')}
                  subtitle={
                    tenantName
                      ? t('allMembersOf', { tenant: tenantName })
                      : t('allMembers')
                  }
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      rightIcon={<ChevronRight size={15} />}
                      onClick={() => router.push(SECTION_HREF.transactions)}
                    >
                      {t('seeAll')}
                    </Button>
                  }
                />
              </div>
              <div style={{ padding: '0 var(--space-4) var(--space-3)' }}>
                {recent.length === 0 ? (
                  <div className="empty-state">
                    <p className="muted">{t('noTransactions')}</p>
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
                            {transaction.description ||
                              t(income ? 'income' : 'expense')}
                          </div>
                          <div className="tx-meta">
                            <span>{formatUtcDate(transaction.occurredAt, locale)}</span>
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
                title={t('accounts')}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(SECTION_HREF.accounts)}
                  >
                    {t('manage')}
                  </Button>
                }
              />
              {accounts.length === 0 ? (
                <p className="muted">{t('noAccounts')}</p>
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
                              {tAccounts(`type.${account.type}`)} · {account.currency}
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
