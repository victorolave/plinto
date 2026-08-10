import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AuthLayout } from '../../../components/layout/auth-layout'
import { fetchCurrentUser } from '../../../lib/auth/server-session'
import { Repeat } from '../../../components/ui/icons'

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

  const t = await getTranslations('login')

  return (
    <AuthLayout
      eyebrow={t('eyebrow')}
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <div className="auth-actions">
        <a href="/api/auth/login" className="btn btn--block auth-cta">
          <LockIcon />
          {t('continueSecurely')}
        </a>
        <p className="auth-reassurance">
          <ShieldIcon />
          {t('reassurance')}
        </p>
      </div>

      <div className="auth-benefits">
        <span className="auth-benefits-label">{t('benefitsLabel')}</span>
        <ul className="auth-benefit-list">
          {BENEFITS.map((benefit) => (
            <li key={benefit.id} className="auth-benefit">
              <span className="auth-benefit-icon" aria-hidden="true">
                {benefit.icon}
              </span>
              <span className="auth-benefit-copy">
                <span className="auth-benefit-title">
                  {t(`benefits.${benefit.id}.title`)}
                </span>
                <span className="auth-benefit-sub">
                  {t(`benefits.${benefit.id}.sub`)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </AuthLayout>
  )
}

// Only the icon and a stable id live here now; both lines of copy come from the
// catalogue, keyed by that id.
const BENEFITS = [
  { id: 'households', icon: <HouseholdIcon /> },
  { id: 'ledger', icon: <LedgerIcon /> },
  { id: 'recurring', icon: <Repeat size={20} /> },
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
