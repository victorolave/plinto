import { getTranslations } from 'next-intl/server'
import { AuthLayout } from '../components/layout/auth-layout'

export default async function NotFound() {
  const t = await getTranslations('notFound')

  return (
    <AuthLayout eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')}>
      <a href="/dashboard" className="btn btn--block">
        {t('backToDashboard')}
      </a>
    </AuthLayout>
  )
}
