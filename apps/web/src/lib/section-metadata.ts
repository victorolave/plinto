import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

type NavKey =
  | 'overview'
  | 'accounts'
  | 'transactions'
  | 'obligations'
  | 'debts'
  | 'credit'
  | 'categories'
  | 'settings'
  | 'help'

// A dashboard section's browser title is its navigation label — the tab
// should say the same thing the sidebar does. The root layout's title
// template appends the product name, so this returns only the section.
export function sectionMetadata(key: NavKey): () => Promise<Metadata> {
  return async () => {
    const t = await getTranslations('nav')
    return { title: t(key) }
  }
}
