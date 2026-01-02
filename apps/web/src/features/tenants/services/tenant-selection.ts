import { apiFetch } from '../../../lib/api/client'

export async function listTenants() {
  return apiFetch('/tenants')
}

export async function selectTenant(tenantId: string) {
  return apiFetch('/tenants/active', {
    method: 'POST',
    body: JSON.stringify({ tenantId }),
  })
}
