import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { OnboardingForm } from '../../../features/auth/components/onboarding-form'

async function checkOnboardingStatus() {
  const sessionCookie = cookies().get('plinto_session')?.value
  if (!sessionCookie) {
    redirect('/login')
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api'
  
  // Ensure we have an absolute URL for server-side fetch
  const meUrl = apiBase.startsWith('http')
    ? `${apiBase}/me`
    : `http://localhost:3001${apiBase}/me`

  try {
    const response = await fetch(meUrl, {
      headers: {
        Cookie: `plinto_session=${sessionCookie}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      redirect('/login')
    }

    const data = await response.json()
    const user = data?.data?.user
    const memberships = data?.data?.memberships ?? []
    const activeTenantId = data?.data?.activeTenantId

    // If user has name and at least one membership, onboarding is complete
    if (user?.name && memberships.length > 0) {
      // Redirect to dashboard or tenant selection
      if (activeTenantId) {
        redirect('/')
      } else {
        redirect('/select-tenant')
      }
    }
  } catch (error: unknown) {
    // NEXT_REDIRECT is a special error thrown by Next.js redirect() function
    // We need to re-throw it to allow the redirect to work
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = (error as { digest?: string }).digest
      if (digest && digest.startsWith('NEXT_REDIRECT')) {
        throw error
      }
    }
    // If we can't verify status, redirect to login
    redirect('/login')
  }
}

export default async function OnboardingPage() {
  await checkOnboardingStatus()

  return (
    <main className="auth-shell">
      <div className="card stack">
        <div className="stack">
          <h1>Complete your profile</h1>
          <p className="muted">Tell us your name and set up your first household.</p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  )
}
