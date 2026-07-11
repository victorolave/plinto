'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { listTenants, selectTenant } from '../services/tenant-selection'
import { queryKeys } from '../../../lib/api/query-keys'
import { ChevronRight } from '../../../components/ui/icons'

export function TenantSelector() {
  const {
    data: tenants = [],
    isLoading: loading,
    error: loadError,
  } = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => (await listTenants()).data.tenants,
  })

  const selectMutation = useMutation({
    mutationFn: (tenantId: string) => selectTenant(tenantId),
    onSuccess: () => {
      window.location.href = '/dashboard'
    },
  })

  const handleSelect = (tenantId: string) => {
    selectMutation.mutate(tenantId)
  }

  const activeError = selectMutation.error ?? loadError
  const error = activeError instanceof Error ? activeError.message : null

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
