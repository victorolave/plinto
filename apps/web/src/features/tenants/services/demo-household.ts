import { apiFetch } from '../../../lib/api/client'
import type { Locale } from '../../../i18n/config'

export interface DemoHouseholdTenant {
  id: string
  name: string
  isDemo: boolean
}

/** Creates the example household for the current user and switches to it. */
export async function createDemoHousehold(
  locale: Locale,
): Promise<{ data: { tenant: DemoHouseholdTenant } }> {
  return apiFetch<{ data: { tenant: DemoHouseholdTenant } }>('/tenants/demo', {
    method: 'POST',
    body: JSON.stringify({ locale }),
  })
}

/** Deletes the example household. Only ever call this with a demo tenant's id. */
export async function deleteDemoHousehold(tenantId: string): Promise<void> {
  await apiFetch(`/tenants/${tenantId}`, { method: 'DELETE' })
}
