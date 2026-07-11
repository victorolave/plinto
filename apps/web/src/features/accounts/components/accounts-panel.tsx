'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreateAccountSchema, UpdateAccountSchema } from '@plinto/shared'
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
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/modal'
import { EmptyState } from '../../../components/ui/empty-state'
import { Plus, Wallet } from '../../../components/ui/icons'
import { AccountsSkeleton } from './accounts-skeleton'

const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit', label: 'Credit' },
  { value: 'savings', label: 'Savings' },
]

type FormMode = 'create' | 'edit'

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

  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [currency, setCurrency] = useState('COP')
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [pendingArchive, setPendingArchive] = useState<Account | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const invalidateAccountData = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.accounts(true) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.balances })
  }

  const createMutation = useMutation({
    mutationFn: (input: { name: string; type: AccountType; currency: string }) =>
      createAccount(input),
    onSuccess: invalidateAccountData,
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: { name: string; type: AccountType }
    }) => updateAccount(id, input),
    onSuccess: invalidateAccountData,
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
    setMode('create')
    setEditingId(null)
    setName('')
    setType('bank')
    setCurrency('COP')
    setError(null)
    setOpen(true)
  }

  const openEdit = (account: Account) => {
    setMode('edit')
    setEditingId(account.id)
    setName(account.name)
    setType(account.type)
    setCurrency(account.currency)
    setError(null)
    setOpen(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (mode === 'edit' && editingId) {
      const input = { name, type }
      const result = UpdateAccountSchema.safeParse(input)
      if (!result.success) {
        setError(result.error.issues[0]?.message ?? 'Invalid account')
        return
      }

      try {
        await updateMutation.mutateAsync({ id: editingId, input })
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update account')
      }
      return
    }

    const input = {
      name,
      type,
      currency: currency.trim().toUpperCase(),
    }
    const result = CreateAccountSchema.safeParse(input)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid account')
      return
    }

    try {
      await createMutation.mutateAsync(input)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    }
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
        title={mode === 'edit' ? 'Edit account' : 'Add account'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="account-form" disabled={submitting}>
              {submitting
                ? mode === 'edit'
                  ? 'Saving…'
                  : 'Creating…'
                : mode === 'edit'
                  ? 'Save changes'
                  : 'Create account'}
            </Button>
          </>
        }
      >
        <form id="account-form" onSubmit={handleSubmit} className="stack">
          <Field label="Account name" htmlFor="account-name">
            <Input
              id="account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Family checking"
              required
            />
          </Field>

          <div className="form-grid">
            <Field label="Account type" htmlFor="account-type">
              <Select
                id="account-type"
                value={type}
                onChange={(event) => setType(event.target.value as AccountType)}
              >
                {accountTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Currency"
              htmlFor="account-currency"
              hint={
                mode === 'edit'
                  ? 'Currency cannot change once the account exists.'
                  : undefined
              }
            >
              <Input
                id="account-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                maxLength={3}
                required
                disabled={mode === 'edit'}
              />
            </Field>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
        </form>
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
