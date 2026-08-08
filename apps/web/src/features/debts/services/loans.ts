import { apiFetch } from '../../../lib/api/client'

export interface LoanResult {
  transfer: { id: string }
  debit: { id: string }
  credit: { id: string }
}

/**
 * Records a loan the household received. The API expresses it as a movement
 * from the lender's liability account, so the cash arrives and the amount owed
 * appears without the household's income figure ever seeing it.
 */
export async function recordLoan(input: {
  lenderAccountId: string
  destinationAccountId: string
  amountMinor: number
  description?: string
  occurredAt?: string
}): Promise<{ data: LoanResult }> {
  return apiFetch<{ data: LoanResult }>('/loans', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
