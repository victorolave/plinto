'use client'

import { useTranslations } from 'next-intl'
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
  const t = useTranslations('accounts')
  const tCommon = useTranslations('common')
  const AccountIcon = accountTypeIcon[account.type]
  return (
    <div className="account-card">
      <div className="account-card-head">
        <span className="account-icon">
          <AccountIcon size={20} />
        </span>
        <div className="account-card-id">
          <div className="account-name">{account.name}</div>
          {/* The account type is a domain enum (`cash`, `bank`, …) that was
              being printed raw. It is a word the user reads, so it gets
              translated like any other. */}
          <div className="account-type">{t(`type.${account.type}`)}</div>
        </div>
        <div className="account-card-actions">
          <ActionsMenu
            label={t('accountActions')}
            items={[
              {
                label: tCommon('edit'),
                icon: <Pencil size={15} />,
                onClick: onEdit,
              },
              {
                label: t('archive'),
                icon: <Trash size={15} />,
                danger: true,
                onClick: onArchive,
              },
            ]}
          />
        </div>
      </div>

      <div className="account-card-balance">
        <span className="plinto-eyebrow">{t('balance')}</span>
        <Amount
          minor={balance?.balanceMinor ?? 0}
          currency={account.currency}
          size="lg"
        />
      </div>
    </div>
  )
}
