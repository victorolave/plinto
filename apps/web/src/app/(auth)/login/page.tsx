import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AuthLayout } from '../../../components/layout/auth-layout'

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
        redirect('/dashboard')
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
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to Plinto"
      subtitle="Continue with your identity provider to reach your households."
    >
      <div className="auth-actions">
        <a href="/api/auth/login" className="btn btn--block auth-cta">
          <LockIcon />
          Continue securely
        </a>
        <p className="auth-reassurance">
          <ShieldIcon />
          Secured by your identity provider — we never see or store your
          password.
        </p>
      </div>

      <div className="auth-benefits">
        <span className="auth-benefits-label">What&rsquo;s inside</span>
        <ul className="auth-benefit-list">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="auth-benefit">
              <span className="auth-benefit-icon" aria-hidden="true">
                {benefit.icon}
              </span>
              <span className="auth-benefit-copy">
                <span className="auth-benefit-title">{benefit.title}</span>
                <span className="auth-benefit-sub">{benefit.sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </AuthLayout>
  )
}

const BENEFITS = [
  {
    title: 'Every household, one account',
    sub: 'Switch between the households you manage without signing in again.',
    icon: <HouseholdIcon />,
  },
  {
    title: 'Accounts, transactions & categories',
    sub: 'Track balances and organize spending in one clear place.',
    icon: <LedgerIcon />,
  },
  {
    title: 'Recurring transactions on autopilot',
    sub: 'Set a rule once and let the monthly entries post themselves.',
    icon: <RepeatIcon />,
  },
] as const

/* Inline icons — Lucide-style, 20px, stroke 1.5, currentColor. */
function iconProps() {
  return {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}

function LockIcon() {
  return (
    <svg {...iconProps()} aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg {...iconProps()} aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function HouseholdIcon() {
  return (
    <svg {...iconProps()} aria-hidden="true">
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  )
}

function LedgerIcon() {
  return (
    <svg {...iconProps()} aria-hidden="true">
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  )
}

function RepeatIcon() {
  return (
    <svg {...iconProps()} aria-hidden="true">
      <path d="M17 3l3 3-3 3" />
      <path d="M20 6H8a4 4 0 0 0-4 4v1" />
      <path d="M7 21l-3-3 3-3" />
      <path d="M4 18h12a4 4 0 0 0 4-4v-1" />
    </svg>
  )
}
