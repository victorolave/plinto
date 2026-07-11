import { apiFetch } from '../../../lib/api/client'

export type AccountType = 'cash' | 'bank' | 'credit' | 'savings'

export interface Account {
  id: string
  tenantId: string
  name: string
  type: AccountType
  currency: string
  createdAt: string
  archivedAt: string | null
}

export async function listAccounts(options: {
  includeArchived?: boolean
} = {}): Promise<{ data: { accounts: Account[] } }> {
  const query = options.includeArchived ? '?includeArchived=true' : ''
  return apiFetch(`/accounts${query}`)
}

export async function createAccount(input: {
  name: string
  type: AccountType
  currency: string
}): Promise<{ data: { account: Account } }> {
  return apiFetch('/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateAccount(
  id: string,
  input: {
    name?: string
    type?: AccountType
  },
): Promise<{ data: { account: Account } }> {
  return apiFetch(`/accounts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/** Soft-delete: the account is archived (hidden) but its history is preserved. */
export async function deleteAccount(
  id: string,
): Promise<{ data: { account: Account } }> {
  return apiFetch(`/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function restoreAccount(
  id: string,
): Promise<{ data: { account: Account } }> {
  return apiFetch(`/accounts/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  })
}
