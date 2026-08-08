'use client'

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
        <h2 className="card-title">
          {accounts.length} account{accounts.length > 1 ? 's' : ''}
        </h2>
        <div className="section-total">
          <span className="plinto-eyebrow">
            {owed > 0 ? `Held in ${currency}` : `Total in ${currency}`}
          </span>
          <Amount minor={total} currency={currency} size="lg" />
          {owed > 0 ? (
            <span className="muted" style={{ fontSize: 12 }}>
              <Amount minor={owed} currency={currency} size="sm" /> owed
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
          Add account
        </button>
      </div>
    </section>
  )
}
