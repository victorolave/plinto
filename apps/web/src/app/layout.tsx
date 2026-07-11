import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { Inter, Montserrat, Roboto_Mono } from 'next/font/google'
import { QueryProvider } from '../components/providers/query-provider'
import '../styles/globals.css'

// Inter — product UI, body & data (the SaaS-native workhorse).
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

// Montserrat — geometric, heavy display & brand, matching the wordmark.
const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
  weight: ['600', '700', '800'],
})

// Roboto Mono — tabular figures so money amounts align.
const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Plinto',
  description: 'Everything your family spends, in one calm place.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${montserrat.variable} ${robotoMono.variable}`}
    >
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
