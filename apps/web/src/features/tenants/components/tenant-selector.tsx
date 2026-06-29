'use client'

import { useEffect, useState } from 'react'
import { listTenants, selectTenant } from '../services/tenant-selection'
import { ChevronRight } from '../../../components/ui/icons'

export function TenantSelector() {
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      try {
        const response = await listTenants()
        setTenants(response?.data?.tenants ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tenants')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [])

  const handleSelect = async (tenantId: string) => {
    try {
      await selectTenant(tenantId)
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select tenant')
    }
  }

  if (loading) {
    return <p className="muted">Loading households…</p>
  }

  if (error) {
    return <p className="error-text">{error}</p>
  }

  if (tenants.length === 0) {
    return <p className="muted">You don’t belong to any household yet.</p>
  }

  return (
    <div className="stack stack--tight">
      {tenants.map((tenant) => (
        <button
          key={tenant.id}
          type="button"
          onClick={() => handleSelect(tenant.id)}
          className="btn btn--secondary btn--block"
          style={{ justifyContent: 'flex-start', height: 'auto', padding: 'var(--space-3)' }}
        >
          <span className="brand-square" style={{ width: 28, height: 28 }}>
            {tenant.name.trim().charAt(0).toUpperCase()}
          </span>
          <span style={{ fontWeight: 'var(--weight-semibold)' }}>{tenant.name}</span>
          <ChevronRight size={16} style={{ marginLeft: 'auto' }} />
        </button>
      ))}
    </div>
  )
}
