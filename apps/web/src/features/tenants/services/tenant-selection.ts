import { apiFetch } from '../../../lib/api/client'

export interface TenantSummary {
  id: string
  name: string
  isDemo: boolean
}

export async function listTenants(): Promise<{ data: { tenants: TenantSummary[] } }> {
  return apiFetch<{ data: { tenants: TenantSummary[] } }>('/tenants')
}

// The caller redirects on success and never reads the payload, so the response
// shape is intentionally left as `unknown` rather than asserting an unverified type.
export async function selectTenant(tenantId: string): Promise<unknown> {
  return apiFetch('/tenants/active', {
    method: 'POST',
    body: JSON.stringify({ tenantId }),
  })
}
