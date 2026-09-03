'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useDashboard } from '../../../components/layout/dashboard-context'
import { useProductTour } from '../../onboarding/tour/product-tour-context'
import { showFirstStepsAgain } from '../../dashboard/components/first-steps-card'
import { Card, CardHeader } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { HelpCircle } from '../../../components/ui/icons'

/**
 * Lets a household replay onboarding on demand instead of only ever seeing
 * it once. Lives on its own Help page (below Settings in the nav, always
 * reachable) rather than inside Settings or on the dashboard itself, where
 * the checklist it re-shows would otherwise have to fight for space with the
 * thing it is re-showing.
 *
 * Starting the tour from here anchors its nav steps to the sidebar, which is
 * present on every dashboard route — the `firstSteps` step is simply skipped
 * because its anchor isn't in the DOM here (see the DOM-presence filter in
 * `tour-steps.ts`), the same way it is skipped on any other non-dashboard
 * route the tour might start from.
 */
export function HelpCard() {
  const t = useTranslations('help')
  const router = useRouter()
  const { activeTenantId } = useDashboard()
  const { start, isRunning } = useProductTour()

  const handleShowFirstSteps = () => {
    showFirstStepsAgain(activeTenantId)
    router.push('/dashboard')
  }

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
          leftIcon={<HelpCircle size={16} />}
          disabled={isRunning}
          onClick={start}
        >
          {t('tourButton')}
        </Button>
        <Button variant="secondary" onClick={handleShowFirstSteps}>
          {t('firstStepsButton')}
        </Button>
      </div>
    </Card>
  )
}
