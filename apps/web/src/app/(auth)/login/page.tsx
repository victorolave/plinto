import { redirect } from 'next/navigation'
import { AuthLayout } from '../../../components/layout/auth-layout'
import { fetchCurrentUser } from '../../../lib/auth/server-session'

// Already-authenticated visitors skip the login screen and land where their
// account state points. redirect() throws NEXT_REDIRECT, which propagates out
// of this un-wrapped call exactly as Next.js expects.
async function redirectIfAuthenticated() {
  const session = await fetchCurrentUser()
  if (!session?.user) {
    return
  }

  const { user, memberships, activeTenantId } = session
  if (!user.name || memberships.length === 0) {
    redirect('/onboarding')
  }
  if (activeTenantId) {
    redirect('/dashboard')
  }
  redirect('/select-tenant')
}

export default async function LoginPage() {
  await redirectIfAuthenticated()

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
