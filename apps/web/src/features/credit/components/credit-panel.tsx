'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  closeCreditLine,
  getCreditSummary,
  type CreditLine,
  type CreditLineWithLatest,
} from '../services/credit'
import { listAccounts } from '../../accounts/services/accounts'
import { queryKeys } from '../../../lib/api/query-keys'
import { CreditLineForm } from './credit-line-form'
import { StatementForm } from './statement-form'
import { Card, CardHeader } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Drawer } from '../../../components/ui/drawer'
import { Modal } from '../../../components/ui/modal'
import { EmptyState } from '../../../components/ui/empty-state'
import { StatCard } from '../../../components/ui/stat-card'
import { Amount, formatMoneyMagnitude } from '../../../components/ui/amount'
import { Plus, Card as CardIcon } from '../../../components/ui/icons'

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    ...DATE_FORMAT,
    timeZone: 'UTC',
  })
}

/** `2026-07` — the period the newest statement belongs to. */
function currentPeriod(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Whether the figure on screen is this month's bill or the last one we know of.
 *
 * The distinction is the whole honesty of this panel: an old number shown
 * without its date reads as current, and a household would pay the wrong
 * amount. Nothing is projected — the line simply reports what it last heard.
 */
function isStale(row: CreditLineWithLatest, now: Date): boolean {
  if (!row.latestStatement) return false
  return row.latestStatement.period !== currentPeriod(now)
}

export function CreditPanel() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [statementFor, setStatementFor] = useState<CreditLine | null>(null)
  // Correcting the line's newest statement. A mistyped figure that cannot be
  // fixed is a figure the household is stuck with, and the advice to enter a
  // statement only once it arrives is guidance, not a mechanism.
  const [editing, setEditing] = useState<CreditLineWithLatest | null>(null)
  // Moving a ceiling. Issuers change limits, and a line set up with a working
  // figure needs to be correctable once the real one is to hand.
  const [editingLine, setEditingLine] = useState<CreditLine | null>(null)
  const [pendingClose, setPendingClose] = useState<CreditLineWithLatest | null>(null)
  const now = new Date()

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.creditSummary,
    queryFn: async () => (await getCreditSummary()).data.creditLines,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: async () => (await listAccounts()).data.accounts,
  })

  const closeMutation = useMutation({
    mutationFn: (id: string) => closeCreditLine(id),
    onSuccess: () => {
      setPendingClose(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.creditLines })
      void queryClient.invalidateQueries({ queryKey: queryKeys.creditSummary })
    },
  })

  const errorMessage =
    error instanceof Error
      ? error.message
      : closeMutation.error instanceof Error
        ? closeMutation.error.message
        : null

  const active = rows.filter((row) => row.status === 'active')
  const closed = rows.filter((row) => row.status !== 'active')

  // Currencies the household already uses, so a card is denominated in one of
  // them rather than in a free-text code nothing else matches.
  const currencies = [...new Set(accounts.map((account) => account.currency))].sort()

  /**
   * Owed and available, per currency, across active lines only.
   *
   * A line with no statement contributes nothing rather than zero: it is not
   * known to owe nothing, it is simply not known.
   */
  const totals = new Map<string, { owedMinor: number; availableMinor: number }>()
  for (const row of active) {
    if (!row.latestStatement) continue
    const bucket = totals.get(row.currency) ?? { owedMinor: 0, availableMinor: 0 }
    bucket.owedMinor += row.latestStatement.closingBalanceMinor
    bucket.availableMinor += row.latestStatement.availableMinor
    totals.set(row.currency, bucket)
  }

  return (
    <div className="page">
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      {totals.size > 0 ? (
        <div className="stat-grid">
          {[...totals.entries()].map(([currency, bucket], index) => (
            <StatCard
              key={currency}
              label={`Owed on credit (${currency})`}
              valueMinor={bucket.owedMinor}
              currency={currency}
              accent={index === 0}
              deltaLabel={`${formatMoneyMagnitude(
                bucket.availableMinor,
                currency,
              )} still available`}
              icon={<CardIcon size={16} />}
            />
          ))}
        </div>
      ) : null}

      <div className="categories-head">
        <span className="muted">
          {isLoading
            ? 'Loading…'
            : `${active.length} credit line${active.length === 1 ? '' : 's'} open`}
        </span>
        <Button leftIcon={<Plus size={18} />} onClick={() => setFormOpen(true)}>
          Add credit line
        </Button>
      </div>

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          icon={<CardIcon size={30} />}
          title="No cards or rotating lines yet"
          description="Add a card or a line like ADDI, then enter each statement as it arrives. One number a month gives you the payment, the balance and how much room you have left."
          action={
            <Button leftIcon={<Plus size={18} />} onClick={() => setFormOpen(true)}>
              Add credit line
            </Button>
          }
        />
      ) : null}

      {[
        { title: 'Open', rows: active },
        { title: 'Closed', rows: closed },
      ]
        .filter((section) => section.rows.length > 0)
        .map((section) => (
          <Card key={section.title} flush>
            <CardHeader title={section.title} />
            <ul className="member-list" aria-label={section.title}>
              {section.rows.map((row) => {
                const statement = row.latestStatement
                const stale = isStale(row, now)

                return (
                  <li key={row.id} className="data-row">
                    <span
                      style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
                    >
                      <span className="account-name">
                        {row.status === 'active' ? (
                          <button
                            type="button"
                            className="link-button"
                            aria-label={`Edit ${row.name} limit`}
                            onClick={() => setEditingLine(row)}
                          >
                            {row.name}
                          </button>
                        ) : (
                          row.name
                        )}{' '}
                        {row.status === 'closed' ? (
                          <Badge tone="neutral">closed</Badge>
                        ) : stale ? (
                          <Badge tone="warning">estimated</Badge>
                        ) : null}
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {statement ? (
                          <>
                            {formatMoneyMagnitude(row.availableMinor ?? 0, row.currency)}{' '}
                            available of{' '}
                            {formatMoneyMagnitude(row.limitMinor, row.currency)} ·{' '}
                            {stale
                              ? `last statement ${formatDay(statement.cutoffDate)}`
                              : `due ${formatDay(statement.dueDate)}`}
                          </>
                        ) : (
                          <>
                            {formatMoneyMagnitude(row.limitMinor, row.currency)} limit ·
                            waiting for the first statement
                          </>
                        )}
                      </span>
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <span style={{ textAlign: 'right' }}>
                        <span className="plinto-eyebrow">
                          {stale ? 'Last paid' : 'To pay'}
                        </span>
                        {statement ? (
                          <Amount
                            minor={statement.amountDueMinor}
                            currency={row.currency}
                          />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </span>
                      {row.status === 'active' ? (
                        <>
                          {statement ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Edit ${row.name} statement`}
                              onClick={() => setEditing(row)}
                            >
                              Edit
                            </Button>
                          ) : null}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setStatementFor(row)}
                          >
                            Add statement
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Close ${row.name}`}
                            onClick={() => setPendingClose(row)}
                          >
                            Close
                          </Button>
                        </>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        ))}

      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add a credit line"
        description="A card, or a rotating line like ADDI"
      >
        <CreditLineForm
          currencies={currencies.length > 0 ? currencies : ['COP']}
          onSaved={() => setFormOpen(false)}
        />
      </Drawer>

      <Drawer
        open={statementFor !== null}
        onClose={() => setStatementFor(null)}
        title={statementFor ? `${statementFor.name} statement` : 'Statement'}
        description="Its payment goes straight onto the obligations board"
      >
        {statementFor ? (
          <StatementForm line={statementFor} onSaved={() => setStatementFor(null)} />
        ) : null}
      </Drawer>

      <Drawer
        open={editingLine !== null}
        onClose={() => setEditingLine(null)}
        title={editingLine ? `Edit ${editingLine.name}` : 'Edit credit line'}
        description="Name and ceiling — statements keep the limit they were measured against"
      >
        {editingLine ? (
          <CreditLineForm
            currencies={currencies.length > 0 ? currencies : [editingLine.currency]}
            line={editingLine}
            onSaved={() => setEditingLine(null)}
          />
        ) : null}
      </Drawer>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Fix ${editing.name} statement` : 'Fix statement'}
        description="The payment on the obligations board changes with it"
      >
        {editing?.latestStatement ? (
          <StatementForm
            line={editing}
            statement={editing.latestStatement}
            onSaved={() => setEditing(null)}
          />
        ) : null}
      </Drawer>

      <Modal
        open={pendingClose !== null}
        onClose={() => setPendingClose(null)}
        title="Close this credit line?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingClose(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={closeMutation.isPending}
              onClick={() => pendingClose && closeMutation.mutate(pendingClose.id)}
            >
              {closeMutation.isPending ? 'Closing…' : 'Close line'}
            </Button>
          </>
        }
      >
        <p className="muted">
          <strong style={{ color: 'var(--text-strong)' }}>{pendingClose?.name}</strong>{' '}
          stops accepting new statements. The ones it already issued stay — some
          of them are paid, and removing them would leave payments with no reason
          behind them.
        </p>
      </Modal>
    </div>
  )
}
