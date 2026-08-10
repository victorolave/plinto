'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { isApiError } from './api-error'

/**
 * Turns whatever a mutation or query threw into a sentence in the user's
 * language.
 *
 * The rule, decided when this was designed: **the API is a contract between
 * machines, the UI is a contract with a person.** So NestJS keeps returning
 * English prose and a stable `code`, and this is the only place that turns a
 * code into words. The backend never learns about `Accept-Language`, and the
 * two never have to be deployed together to fix a typo.
 *
 * The backend's own `message` survives as the fallback for a code that has no
 * entry yet — a new error added on the server shows something true in English
 * rather than a raw `OBLIGATION_CURRENCY_MISMATCH` or a blank space.
 */
export function useErrorMessage(): (error: unknown) => string | null {
  const t = useTranslations('apiErrors')

  return useCallback(
    (error: unknown): string | null => {
      if (error === null || error === undefined) return null

      if (isApiError(error)) {
        // `t.has` keeps an unknown code from rendering as the key itself.
        return t.has(error.code) ? t(error.code) : (error.message ?? t('UNKNOWN'))
      }

      if (error instanceof Error) return error.message

      return t('UNKNOWN')
    },
    [t],
  )
}
