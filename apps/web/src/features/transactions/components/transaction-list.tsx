'use client'

import { useTranslations } from 'next-intl'
import type { Account } from '../../accounts/services/accounts'
import type { Transaction } from '../services/transactions'
import { TransactionRow } from './transaction-row'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { TransactionListSkeleton } from './transactions-skeleton'
import { Filter, List, Plus, Wallet } from '../../../components/ui/icons'

export interface TransactionListProps {
  loading: boolean
  accounts: Account[]
  transactions: Transaction[]
  visibleTransactions: Transaction[]
  accountById: Map<string, Account>
  filtersActive: boolean
  onAddAccount: () => void
  onAddTransaction: () => void
  onClearFilters: () => void
  onEditTransaction: (transaction: Transaction) => void
}

/** Ledger card: loading skeleton, empty states, and the visible (filtered) transaction rows. */
export function TransactionList({
  loading,
  accounts,
  transactions,
  visibleTransactions,
  accountById,
  filtersActive,
  onAddAccount,
  onAddTransaction,
  onClearFilters,
  onEditTransaction,
}: TransactionListProps) {
  const t = useTranslations('transactions')
  const tAccounts = useTranslations('accounts')

  return (
    <Card flush>
      <div className="tx-list">
        {loading ? <TransactionListSkeleton /> : null}
        {!loading && accounts.length === 0 ? (
          <EmptyState
            compact
            icon={<Wallet size={26} />}
            title={t('noAccounts.title')}
            description={t('noAccounts.description')}
            action={
              <Button
                variant="secondary"
                leftIcon={<Plus size={16} />}
                onClick={onAddAccount}
              >
                {tAccounts('addAccount')}
              </Button>
            }
          />
        ) : null}
        {!loading && accounts.length > 0 && transactions.length === 0 ? (
          <EmptyState
            compact
            icon={<List size={26} />}
            title={t('noTransactions.title')}
            description={t('noTransactions.description')}
            action={
              <Button leftIcon={<Plus size={16} />} onClick={onAddTransaction}>
                {t('addTransaction')}
              </Button>
            }
          />
        ) : null}
        {!loading && transactions.length > 0 && visibleTransactions.length === 0 ? (
          <EmptyState
            compact
            icon={<Filter size={24} />}
            title={t('noMatches.title')}
            description={t('noMatches.description')}
            action={
              filtersActive ? (
                <Button variant="secondary" onClick={onClearFilters}>
                  {t('clearFilters')}
                </Button>
              ) : undefined
            }
          />
        ) : null}
        {visibleTransactions.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            account={accountById.get(transaction.accountId)}
            onEdit={() => onEditTransaction(transaction)}
          />
        ))}
      </div>
    </Card>
  )
}
