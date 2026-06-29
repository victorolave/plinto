import { TenantSelector } from '../../../features/tenants/components/tenant-selector'
import { AuthLayout } from '../../../components/layout/auth-layout'

export default function SelectTenantPage() {
  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Choose a household"
      subtitle="Select the household you want to work in right now."
    >
      <TenantSelector />
    </AuthLayout>
  )
}
