'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useDashboard } from '../../../components/layout/dashboard-context'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import { listMembers } from '../../members/services/members'
import { queryKeys } from '../../../lib/api/query-keys'
import { downloadHouseholdExport, downloadTransactionsCsv } from '../services/export'
import { Card, CardHeader } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Download } from '../../../components/ui/icons'

type PendingDownload = 'household' | 'transactions' | null

/**
 * "Your data is yours": lets the owner take the whole household out of
 * Plinto, as a JSON bundle or as a CSV ledger.
 *
 * Owner-gated exactly like the invite button on MembersPanel — same
 * `listMembers` query (sharing its cache entry via `queryKeys.members`), same
 * "nothing until the roster has actually loaded" rule, so this never flashes
 * a control a member or viewer is about to lose.
 */
export function DataExportCard() {
  const t = useTranslations('settings.export')
  const toErrorMessage = useErrorMessage()
  const { user } = useDashboard()

  const { data: members = [], isLoading } = useQuery({
    queryKey: queryKeys.members,
    queryFn: async () => (await listMembers()).data.members,
  })

  const isOwner = members.some(
    (member) =>
      user.email !== undefined &&
      user.email.toLowerCase() === member.email.toLowerCase() &&
      member.role === 'owner',
  )

  const [pending, setPending] = useState<PendingDownload>(null)
  const [error, setError] = useState<unknown>(null)

  if (isLoading || !isOwner) {
    return null
  }

  async function runDownload(kind: 'household' | 'transactions', action: () => Promise<void>) {
    setError(null)
    setPending(kind)
    try {
      await action()
    } catch (caught) {
      setError(caught)
    } finally {
      setPending(null)
    }
  }

  const failure = toErrorMessage(error)

  return (
    <Card flush>
      <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}>
        <CardHeader title={t('title')} subtitle={t('subtitle')} />
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          padding: 'var(--space-5)',
        }}
      >
        <Button
          variant="secondary"
          leftIcon={<Download size={16} />}
          disabled={pending !== null}
          onClick={() => void runDownload('household', downloadHouseholdExport)}
        >
          {pending === 'household' ? t('pending') : t('jsonButton')}
        </Button>
        <Button
          variant="secondary"
          leftIcon={<Download size={16} />}
          disabled={pending !== null}
          onClick={() => void runDownload('transactions', downloadTransactionsCsv)}
        >
          {pending === 'transactions' ? t('pending') : t('csvButton')}
        </Button>
      </div>

      {failure ? (
        <p className="error-text" style={{ padding: '0 var(--space-5) var(--space-5)' }}>
          {failure}
        </p>
      ) : null}

      <p className="muted" style={{ padding: '0 var(--space-5) var(--space-5)' }}>
        {t('minorUnitsNote')}
      </p>
    </Card>
  )
}
