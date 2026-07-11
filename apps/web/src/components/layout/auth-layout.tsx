import Image from 'next/image'
import type { ReactNode } from 'react'

interface AuthLayoutProps {
  /** Small uppercase label above the title. */
  eyebrow: string
  /** Main heading for the screen. */
  title: string
  /** Supporting copy under the title. */
  subtitle: string
  /** The action area — button, form, selector, etc. */
  children: ReactNode
}

/**
 * Split-panel shell shared by every auth screen (login, onboarding,
 * select-tenant, error, not-found): a dark brand panel on the left and a
 * cardless, structured content column on the right (eyebrow → title →
 * subtitle → action → footer). Pages provide the copy and action; the layout
 * owns the structure so every flow stays consistent.
 */
export function AuthLayout({ eyebrow, title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="auth-shell">
      <aside className="auth-brand-panel">
        <Image
          className="auth-brand-illustration"
          src="/brand/auth-financial-journey.png"
          alt=""
          fill
          sizes="(max-width: 860px) 100vw, 47vw"
        />
        <div className="auth-brand-content">
          <Image
            className="auth-brand-logo"
            src="/brand/logo-horizontal-white.png"
            alt="Plinto"
            width={131}
            height={40}
            priority
          />
          <div className="auth-brand-pitch">
            <p className="auth-tagline">Household finances, made simple.</p>
            <p className="auth-brand-sub">
              Track accounts, transactions and categories across every household
              you manage — in one place.
            </p>
          </div>
        </div>
      </aside>

      <section className="auth-content">
        <div className="auth-form">
          <header className="auth-form-head">
            <span className="auth-eyebrow">{eyebrow}</span>
            <h1 className="auth-title">{title}</h1>
            <p className="muted">{subtitle}</p>
          </header>
          {children}
        </div>

        <footer className="auth-footer">
          <a href="mailto:support@plinto.app">Need help?</a>
          <span aria-hidden="true">·</span>
          <a href="/terms">Terms</a>
        </footer>
      </section>
    </main>
  )
}
