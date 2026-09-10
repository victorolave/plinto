'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { setLocale } from '../../../i18n/actions'
import { LOCALES, LOCALE_LABELS, isLocale, type Locale } from '../../../i18n/config'
import { Card, CardHeader } from '../../../components/ui/card'
import { Check } from '../../../components/ui/icons'

/**
 * Language preference.
 *
 * The choice is written to a cookie by a Server Action rather than by
 * `document.cookie`, because the message catalogue is resolved on the server:
 * a client-side write would leave the page rendered in the old language until
 * something else caused a request. `router.refresh()` after the action re-runs
 * the server render, so the interface changes language in place — no reload,
 * no navigation, nothing lost from the page the user was on.
 *
 * Each option is written in its own language ("Español", not "Spanish"),
 * because somebody who cannot read the current language still has to find
 * their own in this list.
 */
export function LanguageSelector() {
  const t = useTranslations('settings.language')
  const current = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const activeLocale: Locale | null = isLocale(current) ? current : null

  const choose = (locale: Locale) => {
    if (locale === activeLocale) return

    startTransition(async () => {
      await setLocale(locale)
      router.refresh()
    })
  }

  return (
    <Card flush>
      <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}>
        <CardHeader title={t('title')} subtitle={t('subtitle')} />
      </div>

      <ul
        className="member-list"
        aria-label={t('title')}
        style={{ marginTop: 'var(--space-4)' }}
      >
        {LOCALES.map((locale) => {
          const isActive = locale === activeLocale

          return (
            <li key={locale} className="data-row">
              <button
                type="button"
                className="link-button"
                aria-current={isActive ? 'true' : undefined}
                disabled={pending}
                onClick={() => choose(locale)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  width: '100%',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                }}
              >
                <span className="account-name">{LOCALE_LABELS[locale]}</span>
                {isActive ? <Check size={16} /> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
