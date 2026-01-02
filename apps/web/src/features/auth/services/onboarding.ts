import { apiFetch } from '../../../lib/api/client'

export async function updateProfile(name: string) {
  return apiFetch('/me', {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export async function createTenant(name: string, baseCurrency?: string) {
  return apiFetch('/tenants', {
    method: 'POST',
    body: JSON.stringify({ name, baseCurrency }),
  })
}
