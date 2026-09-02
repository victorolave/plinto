import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { OnboardingForm } from '../../../features/auth/components/onboarding-form'
import { AuthLayout } from '../../../components/layout/auth-layout'
import { fetchCurrentUser } from '../../../lib/auth/server-session'

// Guards the onboarding screen: no session → login; already onboarded → move on
// to the dashboard or household selection.
async function redirectIfOnboarded() {
  const session = await fetchCurrentUser()
  if (!session?.user) {
    redirect('/login')
  }

  const { user, memberships, activeTenantId } = session
  if (user.name && memberships.length > 0) {
    redirect(activeTenantId ? '/dashboard' : '/select-tenant')
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('onboarding')
  return { title: t('title') }
}

export default async function OnboardingPage() {
  await redirectIfOnboarded()

  const t = await getTranslations('onboarding')

  return (
    <AuthLayout eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')}>
      <OnboardingForm />
    </AuthLayout>
  )
}
