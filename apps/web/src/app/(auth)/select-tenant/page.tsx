import { TenantSelector } from '../../../features/tenants/components/tenant-selector'

export default function SelectTenantPage() {
  return (
    <main className="auth-shell">
      <div className="card stack">
        <div className="stack">
          <h1>Select a tenant</h1>
          <p className="muted">Choose where you want to work right now.</p>
        </div>
        <TenantSelector />
      </div>
    </main>
  )
}
