import type { ReactNode } from 'react'
import { DashboardShell } from '../../components/layout/dashboard-shell'

// The persistent app chrome (sidebar, top bar, bottom nav) and the auth/tenant
// bootstrap live in the shell so they survive navigation between section routes;
// only the active page (`children`) remounts.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
