import { getTranslations } from 'next-intl/server'
import { TenantSelector } from '../../../features/tenants/components/tenant-selector'
import { AuthLayout } from '../../../components/layout/auth-layout'

export default async function SelectTenantPage() {
  const t = await getTranslations('selectTenant')

  return (
    <AuthLayout eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')}>
      <TenantSelector />
    </AuthLayout>
  )
}
