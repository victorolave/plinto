import type { ReactElement, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { DEFAULT_LOCALE, FORMATTING_LOCALE, type Locale } from '../i18n/config'
import en from '../../messages/en.json'
import es from '../../messages/es.json'

const CATALOGUES: Record<Locale, Record<string, unknown>> = { en, es }

/**
 * Builds a fresh QueryClient per call so tests never share cache state or
 * retry timers with each other. Retries are disabled for both queries and
 * mutations so failures surface immediately instead of being retried away.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  /**
   * Which language to render in.
   *
   * Defaults to `TEST_LOCALE` (English), NOT to the app's `DEFAULT_LOCALE`
   * (Spanish). That is a deliberate choice, and worth stating because it looks
   * wrong at first glance:
   *
   * These component tests assert on behaviour — "the row falls back to the type
   * when there is no description", "the sole owner has no demote action". The
   * language they happen to read in is incidental to what they check, so they
   * are pinned to one stable reference language rather than re-translated every
   * time the Spanish copy is reworded.
   *
   * The Spanish side is covered deliberately instead of accidentally:
   * `i18n/__tests__/messages.test.ts` proves every key and placeholder exists in
   * both catalogues, and `i18n/__tests__/spanish-rendering.test.tsx` renders a
   * real component in `es` and asserts both the copy and the `es-CO` number
   * formatting. Pass `locale: 'es'` here to do the same in any other test.
   */
  locale?: Locale
}

/**
 * The reference language component tests render in. See `locale` above for why
 * it is not the app's default.
 */
export const TEST_LOCALE: Locale = 'en'

/**
 * Renders `ui` wrapped in a fresh `QueryClientProvider` and a
 * `NextIntlClientProvider`, so components using TanStack Query hooks
 * (`useQuery`/`useMutation`) or `useTranslations`/`useFormatter` work under RTL
 * without needing a real backend or a real request.
 *
 * The intl provider is not optional: every panel in this app reads at least one
 * message, so a test rendering one without a provider fails on a missing
 * context rather than on whatever it was actually asserting.
 *
 * `timeZone` is pinned to match `i18n/request.ts`. Without it, formatted dates
 * would follow whatever zone the machine running the suite happens to be in,
 * and the suite would pass in Bogotá and fail in CI.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult {
  const {
    queryClient = createTestQueryClient(),
    locale = TEST_LOCALE,
    ...renderOptions
  } = options

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={CATALOGUES[locale]}
        timeZone="America/Bogota"
      >
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

/** The BCP 47 tag the given test locale formats money and dates with. */
export function testFormattingLocale(locale: Locale = TEST_LOCALE): string {
  return FORMATTING_LOCALE[locale]
}
