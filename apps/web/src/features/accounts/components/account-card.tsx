'use client'

import type { Account } from '../services/accounts'
import type { AccountBalance } from '../../transactions/services/transactions'
import { ActionsMenu } from '../../../components/ui/actions-menu'
import { Amount } from '../../../components/ui/amount'
import { Pencil, Trash, accountTypeIcon } from '../../../components/ui/icons'

export interface AccountCardProps {
  account: Account
  balance: AccountBalance | undefined
  onEdit: () => void
  onArchive: () => void
}

/** One account's card: icon, name/type, actions menu, and balance. */
export function AccountCard({ account, balance, onEdit, onArchive }: AccountCardProps) {
  const AccountIcon = accountTypeIcon[account.type]
  return (
    <div className="account-card">
      <div className="account-card-head">
        <span className="account-icon">
          <AccountIcon size={20} />
        </span>
        <div className="account-card-id">
          <div className="account-name">{account.name}</div>
          <div className="account-type">{account.type}</div>
        </div>
        <div className="account-card-actions">
          <ActionsMenu
            label="Account actions"
            items={[
              {
                label: 'Edit',
                icon: <Pencil size={15} />,
                onClick: onEdit,
              },
              {
                label: 'Archive',
                icon: <Trash size={15} />,
                danger: true,
                onClick: onArchive,
              },
            ]}
          />
        </div>
      </div>

      <div className="account-card-balance">
        <span className="plinto-eyebrow">Balance</span>
        <Amount
          minor={balance?.balanceMinor ?? 0}
          currency={account.currency}
          size="lg"
        />
      </div>
    </div>
  )
}
