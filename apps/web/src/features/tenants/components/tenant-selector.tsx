'use client'

import { useEffect, useState } from 'react'
import { listTenants, selectTenant } from '../services/tenant-selection'

export function TenantSelector() {
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>(
    [],
  )
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
      window.location.href = '/(dashboard)'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select tenant')
    }
  }

  if (loading) {
    return <p className="muted">Loading tenants...</p>
  }

  if (error) {
    return <p className="error">{error}</p>
  }

  return (
    <div className="stack">
      {tenants.map((tenant) => (
        <button
          key={tenant.id}
          type="button"
          onClick={() => handleSelect(tenant.id)}
          className="button secondary"
        >
          {tenant.name}
        </button>
      ))}
    </div>
  )
}
