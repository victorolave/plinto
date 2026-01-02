import type { ReactNode } from 'react'
import { Montserrat } from 'next/font/google'
import '../styles/globals.css'

const fontSans = Montserrat({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fontSans.variable} font-sans`}>{children}</body>
    </html>
  )
}
