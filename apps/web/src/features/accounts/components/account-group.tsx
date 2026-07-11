'use client'

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
  const total = accounts.reduce(
    (sum, account) => sum + (balanceByAccount.get(account.id)?.balanceMinor ?? 0),
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
          <span className="plinto-eyebrow">Total in {currency}</span>
          <Amount minor={total} currency={currency} size="lg" />
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
