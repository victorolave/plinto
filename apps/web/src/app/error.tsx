'use client'

import { useTranslations } from 'next-intl'
import { Button } from '../components/ui/button'
import { AuthLayout } from '../components/layout/auth-layout'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errorPage')
  const tCommon = useTranslations('common')

  return (
    <AuthLayout eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')}>
      <Button onClick={reset} block>
        {tCommon('tryAgain')}
      </Button>
    </AuthLayout>
  )
}
