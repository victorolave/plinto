import type { ReactNode } from 'react'

// Auth gating, the app shell and section navigation are all owned by
// <DashboardApp /> (rendered by the page), so the layout is a pass-through.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children
}
