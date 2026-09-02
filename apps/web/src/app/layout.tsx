import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { Archivo, DM_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import { QueryProvider } from '../components/providers/query-provider'
import '../styles/globals.css'

// Archivo carries the whole interface — display, running heads and body
// alike. A Swiss system does not need a second voice to make hierarchy;
// size and tracking do that work.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

// DM Mono sets figures and the 12px caps labels. Tabular digits are what
// make a column of amounts read as a column.
const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
  weight: ['400', '500'],
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app')
  return {
    // Sections set their own title; the template hangs the product name off
    // it so a tab reads "Cuentas · Plinto", never a bare "Cuentas".
    title: { default: t('name'), template: `%s · ${t('name')}` },
    description: t('description'),
    applicationName: t('name'),
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()

  // The whole message catalogue is handed to the client provider. Plinto's two
  // catalogues are small and every route is behind the same authenticated
  // shell, so splitting them per-route would add build complexity to save a few
  // kilobytes on a screen the user has already authenticated to reach.
  const messages = await getMessages()

  return (
    <html lang={locale} className={`${archivo.variable} ${dmMono.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
