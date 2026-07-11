'use client'

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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
import { Button, IconButton } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { Amount, CurrencyTag } from '../../../components/ui/amount'
import { Modal } from '../../../components/ui/modal'
import { EmptyState } from '../../../components/ui/empty-state'
import {
  Plus,
  Pencil,
  Trash,
  Wallet,
  MoreVertical,
  accountTypeIcon,
} from '../../../components/ui/icons'
import { AccountsSkeleton } from './accounts-skeleton'

const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit', label: 'Credit' },
  { value: 'savings', label: 'Savings' },
]

type FormMode = 'create' | 'edit'

/** Per-card actions menu opened by the kebab (⋮) button. */
function AccountActionsMenu({
  onEdit,
  onArchive,
}: {
  onEdit: () => void
  onArchive: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="account-menu" ref={ref}>
      <IconButton
        label="Account actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreVertical size={16} />
      </IconButton>

      {open ? (
        <div className="account-menu-list" role="menu">
          <button
            type="button"
            role="menuitem"
            className="account-menu-item"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
          >
            <Pencil size={15} />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="account-menu-item account-menu-item--danger"
            onClick={() => {
              setOpen(false)
              onArchive()
            }}
          >
            <Trash size={15} />
            Archive
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function AccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [currency, setCurrency] = useState('COP')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [pendingArchive, setPendingArchive] = useState<Account | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const loadAccounts = async () => {
    const [accountsRes, balancesRes] = await Promise.all([
      listAccounts({ includeArchived: true }),
      listBalances(),
    ])
    setAccounts(accountsRes.data.accounts)
    setBalances(balancesRes.data.balances)
  }

  useEffect(() => {
    const run = async () => {
      try {
        await loadAccounts()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load accounts')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

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
    setSubmitting(true)
    setError(null)

    try {
      if (mode === 'edit' && editingId) {
        await updateAccount(editingId, { name, type })
      } else {
        await createAccount({ name, type, currency: currency.trim().toUpperCase() })
      }
      setOpen(false)
      await loadAccounts()
    } catch (err) {
      const fallback =
        mode === 'edit' ? 'Failed to update account' : 'Failed to create account'
      setError(err instanceof Error ? err.message : fallback)
    } finally {
      setSubmitting(false)
    }
  }

  const confirmArchive = async () => {
    if (!pendingArchive) return
    setArchiving(true)
    setActionError(null)
    try {
      await deleteAccount(pendingArchive.id)
      setPendingArchive(null)
      await loadAccounts()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to archive account')
    } finally {
      setArchiving(false)
    }
  }

  const handleRestore = async (account: Account) => {
    setActionError(null)
    try {
      await restoreAccount(account.id)
      await loadAccounts()
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

      {groups.map(([groupCurrency, groupAccounts]) => {
        const total = groupAccounts.reduce(
          (sum, account) => sum + (balanceByAccount.get(account.id)?.balanceMinor ?? 0),
          0,
        )
        return (
          <section key={groupCurrency}>
            <div className="section-head">
              <CurrencyTag currency={groupCurrency} />
              <h2 className="card-title">
                {groupAccounts.length} account{groupAccounts.length > 1 ? 's' : ''}
              </h2>
              <div className="section-total">
                <span className="plinto-eyebrow">Total in {groupCurrency}</span>
                <Amount minor={total} currency={groupCurrency} size="lg" />
              </div>
            </div>

            <div className="account-grid">
              {groupAccounts.map((account) => {
                const AccountIcon = accountTypeIcon[account.type]
                const balance = balanceByAccount.get(account.id)
                return (
                  <div key={account.id} className="account-card">
                    <div className="account-card-head">
                      <span className="account-icon">
                        <AccountIcon size={20} />
                      </span>
                      <div className="account-card-id">
                        <div className="account-name">{account.name}</div>
                        <div className="account-type">{account.type}</div>
                      </div>
                      <div className="account-card-actions">
                        <AccountActionsMenu
                          onEdit={() => openEdit(account)}
                          onArchive={() => setPendingArchive(account)}
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
              })}

              <button type="button" className="account-add" onClick={openCreate}>
                <span className="account-add-icon">
                  <Plus size={20} />
                </span>
                Add account
              </button>
            </div>
          </section>
        )
      })}

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
