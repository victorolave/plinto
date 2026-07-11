import { redirect } from 'next/navigation'
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

export default async function OnboardingPage() {
  await redirectIfOnboarded()

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Complete your profile"
      subtitle="Tell us your name and set up your first household."
    >
      <OnboardingForm />
    </AuthLayout>
  )
}
