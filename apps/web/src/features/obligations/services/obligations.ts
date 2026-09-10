import { apiFetch } from '../../../lib/api/client'

export type ObligationSourceType = 'recurring_rule' | 'manual'

/**
 * Derived server-side from the payments and the due date, never stored — so
 * the client can trust it without recomputing anything.
 */
export type ObligationStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export interface ObligationPayment {
  id: string
  transactionId: string
  amountMinor: number
  currency: string
  occurredAt: string
  createdAt: string
}

export interface ObligationInstance {
  id: string
  tenantId: string
  sourceType: ObligationSourceType
  recurringRuleId: string | null
  period: string
  dueDate: string
  name: string
  expectedAmountMinor: number
  currency: string
  status: ObligationStatus
  paidAmountMinor: number
  outstandingAmountMinor: number
  payments: ObligationPayment[]
  createdAt: string
  updatedAt: string
}

/**
 * One set of totals per currency. A household can owe in more than one, and
 * the outstanding figure is the sum of each obligation's own shortfall — not
 * expected minus paid, which understates the debt whenever something is
 * overpaid.
 */
export interface ObligationCurrencyTotal {
  currency: string
  expectedMinor: number
  paidMinor: number
  outstandingMinor: number
}

export interface ObligationPeriodSummary {
  period: string
  totals: ObligationCurrencyTotal[]
}

type ObligationResponse = Promise<{ data: { obligation: ObligationInstance } }>

export async function listObligations(
  period?: string,
): Promise<{ data: { obligations: ObligationInstance[] } }> {
  const query = period ? `?period=${encodeURIComponent(period)}` : ''
  return apiFetch<{ data: { obligations: ObligationInstance[] } }>(
    `/obligations${query}`,
  )
}

export async function getObligationSummary(
  period?: string,
): Promise<{ data: { summary: ObligationPeriodSummary } }> {
  const query = period ? `?period=${encodeURIComponent(period)}` : ''
  return apiFetch<{ data: { summary: ObligationPeriodSummary } }>(
    `/obligations/summary${query}`,
  )
}

export async function createObligation(input: {
  name: string
  period: string
  dueDate: string
  expectedAmountMinor: number
  currency: string
}): ObligationResponse {
  return apiFetch<{ data: { obligation: ObligationInstance } }>('/obligations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * A movement to record and settle the obligation with, in one request.
 *
 * No `type` and no `currency`: only an expense can settle money owed, and a
 * movement takes its account's currency. The API decides both.
 */
export interface NewObligationPayment {
  accountId: string
  amountMinor: number
  description?: string
  occurredAt?: string
  categoryId?: string | null
}

/**
 * Declares which movement settles (part of) the obligation.
 *
 * Either one already in the ledger, or one recorded in the same request — the
 * API rejects a body carrying both, so this takes one argument, not two
 * optional ones.
 */
export async function reconcileObligation(
  obligationId: string,
  payment: { transactionId: string } | { transaction: NewObligationPayment },
): ObligationResponse {
  return apiFetch<{ data: { obligation: ObligationInstance } }>(
    `/obligations/${encodeURIComponent(obligationId)}/payments`,
    { method: 'POST', body: JSON.stringify(payment) },
  )
}

/** Frees the transaction to settle a different obligation. */
export async function removeObligationPayment(
  obligationId: string,
  transactionId: string,
): ObligationResponse {
  return apiFetch<{ data: { obligation: ObligationInstance } }>(
    `/obligations/${encodeURIComponent(obligationId)}/payments/${encodeURIComponent(transactionId)}`,
    { method: 'DELETE' },
  )
}
