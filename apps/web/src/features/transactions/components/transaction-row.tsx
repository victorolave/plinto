'use client'

import { useTranslations } from 'next-intl'
import { useFormattingLocale } from '../../../i18n/formatting'
import type { Account } from '../../accounts/services/accounts'
import type { Transaction } from '../services/transactions'
import { Amount } from '../../../components/ui/amount'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Briefcase, Cart, Pencil, Repeat } from '../../../components/ui/icons'
import {
  formatOccurredAtDate,
  isAutomaticRecurringTransaction,
} from '../lib/transaction-input'

export interface TransactionRowProps {
  transaction: Transaction
  account: Account | undefined
  onEdit: () => void
}

/** One row in the transaction ledger: icon, description/date/account, amount, edit action. */
export function TransactionRow({ transaction, account, onEdit }: TransactionRowProps) {
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const locale = useFormattingLocale()
  const income = transaction.type === 'income'
  const RowIcon = income ? Briefcase : Cart
  const automatic = isAutomaticRecurringTransaction(transaction)
  return (
    <div className="tx-row">
      <span className="tx-icon">
        <RowIcon size={18} />
      </span>
      <div className="tx-main">
        <div className="tx-title">
          {transaction.description || t(income ? 'income' : 'expense')}
        </div>
        <div className="tx-meta">
          <span>{formatOccurredAtDate(transaction.occurredAt, locale)}</span>
          {account ? (
            <>
              <span>·</span>
              <span>{account.name}</span>
            </>
          ) : null}
          {automatic ? (
            <Badge tone="info">
              <Repeat size={11} /> {t('automatic')}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="tx-right">
        <Amount
          minor={income ? transaction.amountMinor : -transaction.amountMinor}
          currency={transaction.currency}
          size="sm"
          colorize
          showSign
        />
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Pencil size={15} />}
          onClick={onEdit}
        >
          {tCommon('edit')}
        </Button>
      </div>
    </div>
  )
}
