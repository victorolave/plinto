import { apiFetch } from '../../../lib/api/client'

export type AccountType = 'cash' | 'bank' | 'credit' | 'savings'

export interface Account {
  id: string
  tenantId: string
  name: string
  type: AccountType
  currency: string
  createdAt: string
}

export async function listAccounts(): Promise<{ data: { accounts: Account[] } }> {
  return apiFetch('/accounts')
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
