/**
 * Single source of truth for dashboard navigation. Sidebar, bottom nav and the
 * shell all derive the active section from the URL via `sectionFromPath`, and
 * link to sections via `SECTION_HREF` — so navigation is real routing, not
 * in-memory state, and the address bar always reflects where you are.
 */
export type DashboardSection =
  | 'overview'
  | 'accounts'
  | 'transactions'
  | 'categories'
  | 'settings'

export const SECTION_HREF: Record<DashboardSection, string> = {
  overview: '/dashboard',
  accounts: '/dashboard/accounts',
  transactions: '/dashboard/transactions',
  categories: '/dashboard/categories',
  settings: '/dashboard/settings',
}

/** Longest-prefix match so nested paths still resolve to their section. */
export function sectionFromPath(pathname: string): DashboardSection {
  const sections: DashboardSection[] = [
    'accounts',
    'transactions',
    'categories',
    'settings',
  ]
  for (const section of sections) {
    const href = SECTION_HREF[section]
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      return section
    }
  }
  return 'overview'
}
