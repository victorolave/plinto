import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

async function checkSession() {
  const sessionCookie = cookies().get('plinto_session')?.value
  if (!sessionCookie) {
    return null
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
      // Session is invalid, allow login
      return null
    }

    const data = await response.json()
    const activeTenantId = data?.data?.activeTenantId
    const memberships = data?.data?.memberships ?? []
    const user = data?.data?.user

    // If user has valid session, redirect based on their state
    if (user) {
      // If onboarding is not complete, redirect to onboarding
      if (!user.name || memberships.length === 0) {
        redirect('/onboarding')
      }
      // If has active tenant, go to dashboard
      if (activeTenantId) {
        redirect('/')
      }
      // Otherwise, go to tenant selection
      redirect('/select-tenant')
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
    // If we can't verify session, allow login
    return null
  }
}

export default async function LoginPage() {
  await checkSession()

  return (
    <main className="auth-shell">
      <div className="card stack">
        <div className="stack">
          <h1>Sign in</h1>
          <p className="muted">Continue with your identity provider to access Plinto.</p>
        </div>
        <a href="/api/auth/login" className="button">
          Continue
        </a>
      </div>
    </main>
  )
}
