'use client'

import { useTranslations } from 'next-intl'
import { isLiabilityAccountType } from '@plinto/shared'
import type { Account } from '../services/accounts'
import type { AccountBalance } from '../../transactions/services/transactions'
import { AccountCard } from './account-card'
import { Amount, CurrencyTag } from '../../../components/ui/amount'
import { Plus } from '../../../components/ui/icons'

export interface AccountGroupProps {
  currency: string
  accounts: Account[]
  balanceByAccount: Map<string, AccountBalance>
  onEdit: (account: Account) => void
  onArchive: (account: Account) => void
  onAddAccount: () => void
}

/** One currency's section: header with totals, its account cards, and an add-account tile. */
export function AccountGroup({
  currency,
  accounts,
  balanceByAccount,
  onEdit,
  onArchive,
  onAddAccount,
}: AccountGroupProps) {
  const t = useTranslations('accounts')

  // Assets only, for the same reason the dashboard splits them: a section
  // total that quietly nets a debt account against a bank account stops being
  // the number somebody came here to read.
  const total = accounts.reduce(
    (sum, account) =>
      isLiabilityAccountType(account.type)
        ? sum
        : sum + (balanceByAccount.get(account.id)?.balanceMinor ?? 0),
    0,
  )

  const owed = accounts.reduce(
    (sum, account) =>
      isLiabilityAccountType(account.type)
        ? sum - (balanceByAccount.get(account.id)?.balanceMinor ?? 0)
        : sum,
    0,
  )

  return (
    <section>
      <div className="section-head">
        <CurrencyTag currency={currency} />
        <h2 className="card-title">{t('accountCount', { count: accounts.length })}</h2>
        <div className="section-total">
          <span className="plinto-eyebrow">
            {owed > 0 ? t('heldIn', { currency }) : t('totalIn', { currency })}
          </span>
          <Amount minor={total} currency={currency} size="lg" />
          {owed > 0 ? (
            <span className="muted" style={{ fontSize: 12 }}>
              <Amount minor={owed} currency={currency} size="sm" /> {t('owed')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="account-grid">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            balance={balanceByAccount.get(account.id)}
            onEdit={() => onEdit(account)}
            onArchive={() => onArchive(account)}
          />
        ))}

        <button type="button" className="account-add" onClick={onAddAccount}>
          <span className="account-add-icon">
            <Plus size={20} />
          </span>
          {t('addAccount')}
        </button>
      </div>
    </section>
  )
}
