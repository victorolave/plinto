'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { useDashboard } from '../../../components/layout/dashboard-context'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import { isLocale } from '../../../i18n/config'
import { createDemoHousehold, deleteDemoHousehold } from '../../tenants/services/demo-household'
import { selectTenant } from '../../tenants/services/tenant-selection'
import { Card, CardHeader } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/modal'

/**
 * Create, flag and delete the example household — a separate tenant filled
 * with invented Colombian sample data, never real data.
 *
 * The tenant list already carries `isDemo` (from `GET /tenants`), so "does
 * the user have one" is a lookup here rather than a second request — the
 * same list `TenantSwitcher` renders from, kept in sync via `DashboardShell`.
 */
export function ExampleHouseholdCard() {
  const t = useTranslations('settings.demo')
  const tCommon = useTranslations('common')
  const toErrorMessage = useErrorMessage()
  const rawLocale = useLocale()
  const locale = isLocale(rawLocale) ? rawLocale : 'es'
  const { tenants, onSelectTenant } = useDashboard()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const demoTenant = tenants.find((tenant) => tenant.isDemo) ?? null

  const createMutation = useMutation({
    mutationFn: () => createDemoHousehold(locale),
    onSuccess: () => {
      // The API already switched the active tenant to the new household.
      window.location.reload()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!demoTenant) return
      await deleteDemoHousehold(demoTenant.id)

      const fallback = tenants.find((tenant) => tenant.id !== demoTenant.id && !tenant.isDemo)
      if (fallback) {
        await selectTenant(fallback.id)
      }
    },
    onSuccess: () => {
      setConfirmOpen(false)
      window.location.reload()
    },
  })

  const error = toErrorMessage(createMutation.error ?? deleteMutation.error)

  return (
    <>
      <Card flush>
        <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}>
          <CardHeader
            title={t('title')}
            subtitle={demoTenant ? t('existingSubtitle') : t('subtitle')}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            padding: 'var(--space-5)',
          }}
        >
          {demoTenant ? (
            <>
              <Button variant="secondary" onClick={() => onSelectTenant(demoTenant.id)}>
                {t('goToButton')}
              </Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                {t('deleteButton')}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? t('creating') : t('createButton')}
            </Button>
          )}
        </div>

        {error ? (
          <p className="error-text" style={{ padding: '0 var(--space-5) var(--space-5)' }}>
            {error}
          </p>
        ) : null}
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('deleteModal.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? t('deleteModal.deleting') : t('deleteModal.confirm')}
            </Button>
          </>
        }
      >
        <p className="muted">{t('deleteModal.body')}</p>
      </Modal>
    </>
  )
}
