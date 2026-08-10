'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import {
  Account,
  AccountType,
  createAccount,
  deleteAccount,
  listAccounts,
  restoreAccount,
  updateAccount,
} from '../services/accounts'
import {
  listBalances,
  type AccountBalance,
} from '../../transactions/services/transactions'
import { queryKeys } from '../../../lib/api/query-keys'
import { AccountGroup } from './account-group'
import { AccountForm } from './account-form'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/modal'
import { EmptyState } from '../../../components/ui/empty-state'
import { Plus, Wallet } from '../../../components/ui/icons'
import { AccountsSkeleton } from './accounts-skeleton'

export function AccountsPanel() {
  const t = useTranslations('accounts')
  const tCommon = useTranslations('common')
  const toErrorMessage = useErrorMessage()
  const queryClient = useQueryClient()

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(true),
    queryFn: async () => (await listAccounts({ includeArchived: true })).data.accounts,
  })
  const balancesQuery = useQuery({
    queryKey: queryKeys.balances,
    queryFn: async () => (await listBalances()).data.balances,
  })

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const balances = useMemo(() => balancesQuery.data ?? [], [balancesQuery.data])
  const loading = accountsQuery.isLoading || balancesQuery.isLoading

  const [open, setOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const [pendingArchive, setPendingArchive] = useState<Account | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const invalidateAccountData = () => {
    // Invalidate by the ['accounts'] prefix so BOTH includeArchived variants
    // refresh: this panel reads accounts(true), while the transactions panel and
    // dashboard read accounts(false). A key-specific invalidation would leave
    // those other views showing a stale account list until staleTime elapses.
    void queryClient.invalidateQueries({ queryKey: ['accounts'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.balances })
  }

  // AccountForm owns field state and validation; it calls these mutations
  // directly so the panel keeps sole ownership of cache invalidation and the
  // Modal open/close lifecycle (see onSuccess below).
  const createMutation = useMutation({
    mutationFn: (input: { name: string; type: AccountType; currency: string }) =>
      createAccount(input),
    onSuccess: () => {
      invalidateAccountData()
      setOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: { name: string; type: AccountType }
    }) => updateAccount(id, input),
    onSuccess: () => {
      invalidateAccountData()
      setOpen(false)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => {
      invalidateAccountData()
      setPendingArchive(null)
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreAccount(id),
    onSuccess: invalidateAccountData,
  })

  const submitting = createMutation.isPending || updateMutation.isPending
  const archiving = archiveMutation.isPending
  // Archive/restore errors are derived straight from the mutations rather than a
  // separate actionError state.
  const actionErrorMessage = toErrorMessage(archiveMutation.error ?? restoreMutation.error)

  const balanceByAccount = useMemo(
    () => new Map(balances.map((b) => [b.accountId, b])),
    [balances],
  )

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.archivedAt),
    [accounts],
  )
  const archivedAccounts = useMemo(
    () => accounts.filter((a) => a.archivedAt),
    [accounts],
  )

  const groups = useMemo(() => {
    const map = new Map<string, Account[]>()
    for (const account of activeAccounts) {
      const list = map.get(account.currency) ?? []
      list.push(account)
      map.set(account.currency, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [activeAccounts])

  const openCreate = () => {
    setEditingAccount(null)
    setOpen(true)
  }

  const openEdit = (account: Account) => {
    setEditingAccount(account)
    setOpen(true)
  }

  const confirmArchive = () => {
    if (pendingArchive) archiveMutation.mutate(pendingArchive.id)
  }

  const handleRestore = (account: Account) => {
    restoreMutation.mutate(account.id)
  }

  return (
    <div className="page">
      {loading ? <AccountsSkeleton /> : null}

      {actionErrorMessage ? <p className="error-text">{actionErrorMessage}</p> : null}

      {!loading && activeAccounts.length === 0 ? (
        <EmptyState
          icon={<Wallet size={30} />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button leftIcon={<Plus size={18} />} onClick={openCreate}>
              {t('addAccount')}
            </Button>
          }
        />
      ) : null}

      {groups.map(([groupCurrency, groupAccounts]) => (
        <AccountGroup
          key={groupCurrency}
          currency={groupCurrency}
          accounts={groupAccounts}
          balanceByAccount={balanceByAccount}
          onEdit={openEdit}
          onArchive={setPendingArchive}
          onAddAccount={openCreate}
        />
      ))}

      {archivedAccounts.length > 0 ? (
        <section className="archived-section">
          <button
            type="button"
            className="archived-toggle"
            onClick={() => setShowArchived((prev) => !prev)}
            aria-expanded={showArchived}
          >
            {showArchived
              ? t('hideArchived', { count: archivedAccounts.length })
              : t('showArchived', { count: archivedAccounts.length })}
          </button>

          {showArchived ? (
            <div className="archived-list">
              {archivedAccounts.map((account) => (
                <div key={account.id} className="archived-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="account-name">{account.name}</div>
                    <div className="account-meta">
                      {t(`type.${account.type}`)} · {account.currency}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRestore(account)}
                  >
                    {t('restore')}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingAccount ? t('editAccount') : t('addAccount')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" form="account-form" disabled={submitting}>
              {submitting
                ? editingAccount
                  ? tCommon('saving')
                  : t('creating')
                : editingAccount
                  ? t('saveChanges')
                  : t('createAccount')}
            </Button>
          </>
        }
      >
        <AccountForm
          editing={editingAccount}
          createMutation={createMutation}
          updateMutation={updateMutation}
        />
      </Modal>

      <Modal
        open={pendingArchive !== null}
        onClose={() => setPendingArchive(null)}
        title={t('archiveModal.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingArchive(null)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" onClick={confirmArchive} disabled={archiving}>
              {archiving ? t('archiveModal.archiving') : t('archiveModal.confirm')}
            </Button>
          </>
        }
      >
        <p className="muted">
          {t.rich('archiveModal.body', {
            name: pendingArchive?.name ?? '',
            strong: (chunks) => (
              <strong style={{ color: 'var(--text-strong)' }}>{chunks}</strong>
            ),
          })}
        </p>
      </Modal>
    </div>
  )
}
