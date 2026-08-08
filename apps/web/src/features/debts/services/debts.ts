import { apiFetch } from '../../../lib/api/client'

export interface DebtSchedule {
  id: string
  tenantId: string
  accountId: string
  name: string
  /** Total that will be repaid, interest included. */
  principalMinor: number
  installmentMinor: number
  installmentCount: number
  firstDueDate: string
  currency: string
  status: 'active' | 'cancelled'
  createdAt: string
  /** Derived from the payments settling this plan's installments. */
  paidMinor: number
  outstandingMinor: number
  settled: boolean
}

export async function listDebts(): Promise<{ data: { debts: DebtSchedule[] } }> {
  return apiFetch<{ data: { debts: DebtSchedule[] } }>('/debts')
}

export async function createDebt(input: {
  accountId: string
  name: string
  principalMinor: number
  installmentMinor: number
  installmentCount: number
  firstDueDate: string
}): Promise<{ data: { debt: DebtSchedule } }> {
  return apiFetch<{ data: { debt: DebtSchedule } }>('/debts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function cancelDebt(id: string): Promise<{ data: { debt: DebtSchedule } }> {
  return apiFetch<{ data: { debt: DebtSchedule } }>(
    `/debts/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  )
}
