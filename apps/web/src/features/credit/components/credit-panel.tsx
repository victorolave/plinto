'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useFormattingLocale } from '../../../i18n/formatting'
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
import { StatGridSkeleton } from '../../../components/ui/stat-grid-skeleton'
import { CreditListSkeleton } from './credit-skeleton'
import { Amount, formatMoneyMagnitude } from '../../../components/ui/amount'
import { Plus, Card as CardIcon } from '../../../components/ui/icons'

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }

function formatDay(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
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
  const t = useTranslations('credit')
  const tCommon = useTranslations('common')
  const locale = useFormattingLocale()
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

      {isLoading ? <StatGridSkeleton cards={1} /> : null}

      {totals.size > 0 ? (
        <div className="stat-grid">
          {[...totals.entries()].map(([currency, bucket], index) => (
            <StatCard
              key={currency}
              label={t('owedOnCredit', { currency })}
              valueMinor={bucket.owedMinor}
              currency={currency}
              accent={index === 0}
              deltaLabel={t('stillAvailable', {
                amount: formatMoneyMagnitude(bucket.availableMinor, currency, locale),
              })}
              icon={<CardIcon size={16} />}
            />
          ))}
        </div>
      ) : null}

      <div className="categories-head">
        {/* While loading this is a placeholder rather than the word "Loading…":
            the skeletons above and below already say the page is busy, and a
            text label beside them reads as a third, competing signal. */}
        {isLoading ? (
          <span
            className="skeleton skeleton-line"
            style={{ width: 132, height: 12 }}
            aria-hidden="true"
          />
        ) : (
          <span className="muted">{t('linesOpen', { count: active.length })}</span>
        )}
        <Button leftIcon={<Plus size={18} />} onClick={() => setFormOpen(true)}>
          {t('addCreditLine')}
        </Button>
      </div>

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          icon={<CardIcon size={30} />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button leftIcon={<Plus size={18} />} onClick={() => setFormOpen(true)}>
              {t('addCreditLine')}
            </Button>
          }
        />
      ) : null}

      {isLoading ? <CreditListSkeleton /> : null}

      {/* `id` is the React key and `title` is the rendered copy — they used to
          be the same English string, which would have made the key change with
          the language. */}
      {[
        { id: 'open', title: t('section.open'), rows: active },
        { id: 'closed', title: t('section.closed'), rows: closed },
      ]
        .filter((section) => section.rows.length > 0)
        .map((section) => (
          <Card key={section.id} flush>
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
                            aria-label={t('editLimitFor', { name: row.name })}
                            onClick={() => setEditingLine(row)}
                          >
                            {row.name}
                          </button>
                        ) : (
                          row.name
                        )}{' '}
                        {row.status === 'closed' ? (
                          <Badge tone="neutral">{t('badge.closed')}</Badge>
                        ) : stale ? (
                          <Badge tone="warning">{t('badge.estimated')}</Badge>
                        ) : null}
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {statement ? (
                          <>
                            {t('availableOfLimit', {
                              available: formatMoneyMagnitude(
                                row.availableMinor ?? 0,
                                row.currency,
                                locale,
                              ),
                              limit: formatMoneyMagnitude(
                                row.limitMinor,
                                row.currency,
                                locale,
                              ),
                            })}
                            {' · '}
                            {stale
                              ? t('lastStatementOn', {
                                  day: formatDay(statement.cutoffDate, locale),
                                })
                              : t('dueOn', {
                                  day: formatDay(statement.dueDate, locale),
                                })}
                          </>
                        ) : (
                          t('limitAwaitingFirstStatement', {
                            limit: formatMoneyMagnitude(
                              row.limitMinor,
                              row.currency,
                              locale,
                            ),
                          })
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
                          {stale ? t('lastPaid') : t('toPay')}
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
                              aria-label={t('editStatementFor', { name: row.name })}
                              onClick={() => setEditing(row)}
                            >
                              {tCommon('edit')}
                            </Button>
                          ) : null}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setStatementFor(row)}
                          >
                            {t('addStatement')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t('closeLineFor', { name: row.name })}
                            onClick={() => setPendingClose(row)}
                          >
                            {t('closeAction')}
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
        title={t('drawer.addTitle')}
        description={t('drawer.addDescription')}
      >
        <CreditLineForm
          currencies={currencies.length > 0 ? currencies : ['COP']}
          onSaved={() => setFormOpen(false)}
        />
      </Drawer>

      <Drawer
        open={statementFor !== null}
        onClose={() => setStatementFor(null)}
        title={
          statementFor
            ? t('drawer.statementTitle', { name: statementFor.name })
            : t('drawer.statementFallback')
        }
        description={t('drawer.statementDescription')}
      >
        {statementFor ? (
          <StatementForm line={statementFor} onSaved={() => setStatementFor(null)} />
        ) : null}
      </Drawer>

      <Drawer
        open={editingLine !== null}
        onClose={() => setEditingLine(null)}
        title={
          editingLine
            ? t('drawer.editLineTitle', { name: editingLine.name })
            : t('drawer.editLineFallback')
        }
        description={t('drawer.editLineDescription')}
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
        title={
          editing
            ? t('drawer.fixStatementTitle', { name: editing.name })
            : t('drawer.fixStatementFallback')
        }
        description={t('drawer.fixStatementDescription')}
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
        title={t('closeModal.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingClose(null)}>
              {t('closeModal.keepIt')}
            </Button>
            <Button
              variant="danger"
              disabled={closeMutation.isPending}
              onClick={() => pendingClose && closeMutation.mutate(pendingClose.id)}
            >
              {closeMutation.isPending
                ? t('closeModal.closing')
                : t('closeModal.confirm')}
            </Button>
          </>
        }
      >
        {/* `t.rich` rather than string concatenation: the emphasised line name
            sits mid-sentence, and where it sits differs by language. */}
        <p className="muted">
          {t.rich('closeModal.body', {
            name: pendingClose?.name ?? '',
            strong: (chunks) => (
              <strong style={{ color: 'var(--text-strong)' }}>{chunks}</strong>
            ),
          })}
        </p>
      </Modal>
    </div>
  )
}
