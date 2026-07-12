'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

  const [actionError, setActionError] = useState<string | null>(null)

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
    onSuccess: invalidateAccountData,
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreAccount(id),
    onSuccess: invalidateAccountData,
  })

  const submitting = createMutation.isPending || updateMutation.isPending
  const archiving = archiveMutation.isPending

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

  const confirmArchive = async () => {
    if (!pendingArchive) return
    setActionError(null)
    try {
      await archiveMutation.mutateAsync(pendingArchive.id)
      setPendingArchive(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to archive account')
    }
  }

  const handleRestore = async (account: Account) => {
    setActionError(null)
    try {
      await restoreMutation.mutateAsync(account.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to restore account')
    }
  }

  return (
    <div className="page">
      {loading ? <AccountsSkeleton /> : null}

      {actionError ? <p className="error-text">{actionError}</p> : null}

      {!loading && activeAccounts.length === 0 ? (
        <EmptyState
          icon={<Wallet size={30} />}
          title="Start with your first account"
          description="An account is where your money lives — a bank, a wallet, a credit card. Each one tracks a single currency so your balances always stay clean."
          action={
            <Button leftIcon={<Plus size={18} />} onClick={openCreate}>
              Add account
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
            {showArchived ? 'Hide' : 'Show'} archived ({archivedAccounts.length})
          </button>

          {showArchived ? (
            <div className="archived-list">
              {archivedAccounts.map((account) => (
                <div key={account.id} className="archived-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="account-name">{account.name}</div>
                    <div className="account-meta">
                      {account.type} · {account.currency}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRestore(account)}
                  >
                    Restore
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
        title={editingAccount ? 'Edit account' : 'Add account'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="account-form" disabled={submitting}>
              {submitting
                ? editingAccount
                  ? 'Saving…'
                  : 'Creating…'
                : editingAccount
                  ? 'Save changes'
                  : 'Create account'}
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
        title="Archive account?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingArchive(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmArchive} disabled={archiving}>
              {archiving ? 'Archiving…' : 'Archive account'}
            </Button>
          </>
        }
      >
        <p className="muted">
          <strong style={{ color: 'var(--text-strong)' }}>
            {pendingArchive?.name}
          </strong>{' '}
          will be hidden from your accounts and transaction forms. Its history stays
          intact and you can restore it any time.
        </p>
      </Modal>
    </div>
  )
}
