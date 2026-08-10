import { apiFetch } from '../../../lib/api/client'

export interface CreditLine {
  id: string
  tenantId: string
  name: string
  limitMinor: number
  currency: string
  status: 'active' | 'closed'
  createdAt: string
}

export interface CreditLineStatement {
  id: string
  tenantId: string
  creditLineId: string
  period: string
  cutoffDate: string
  dueDate: string
  /** Total owed, as the issuer declares it. */
  closingBalanceMinor: number
  /** What must be paid against this statement. */
  amountDueMinor: number
  /** The ceiling at that cutoff, frozen when the statement was recorded. */
  limitMinorSnapshot: number
  currency: string
  createdAt: string
  /** Derived: the snapshotted ceiling minus what the statement declared owed. */
  availableMinor: number
}

/**
 * A line with what its last statement said.
 *
 * `latestStatement` and `availableMinor` are null when no statement has been
 * recorded yet — not zero. Zero available and zero owed is a claim; "not known
 * yet" is the truth, and a board must not show the two the same way.
 */
export interface CreditLineWithLatest extends CreditLine {
  latestStatement: CreditLineStatement | null
  availableMinor: number | null
}

export async function listCreditLines(): Promise<{
  data: { creditLines: CreditLine[] }
}> {
  return apiFetch<{ data: { creditLines: CreditLine[] } }>('/credit-lines')
}

export async function getCreditSummary(): Promise<{
  data: { creditLines: CreditLineWithLatest[] }
}> {
  return apiFetch<{ data: { creditLines: CreditLineWithLatest[] } }>(
    '/credit-lines/summary',
  )
}

export async function createCreditLine(input: {
  name: string
  limitMinor: number
  currency: string
}): Promise<{ data: { creditLine: CreditLine } }> {
  return apiFetch<{ data: { creditLine: CreditLine } }>('/credit-lines', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function closeCreditLine(
  id: string,
): Promise<{ data: { creditLine: CreditLine } }> {
  return apiFetch<{ data: { creditLine: CreditLine } }>(
    `/credit-lines/${encodeURIComponent(id)}/close`,
    { method: 'POST' },
  )
}

export async function listStatements(
  creditLineId: string,
): Promise<{ data: { statements: CreditLineStatement[] } }> {
  return apiFetch<{ data: { statements: CreditLineStatement[] } }>(
    `/credit-lines/${encodeURIComponent(creditLineId)}/statements`,
  )
}

/**
 * Corrects a statement, and the obligation it produced with it.
 *
 * The cutoff is not editable: the period is derived from it, so moving it
 * would move the obligation between months. Everything else can be fixed —
 * a mistyped figure that cannot be corrected is a figure the household is
 * stuck with.
 */
export async function updateStatement(
  creditLineId: string,
  statementId: string,
  input: {
    dueDate?: string
    closingBalanceMinor?: number
    amountDueMinor?: number
  },
): Promise<{ data: { statement: CreditLineStatement } }> {
  return apiFetch<{ data: { statement: CreditLineStatement } }>(
    `/credit-lines/${encodeURIComponent(creditLineId)}/statements/${encodeURIComponent(
      statementId,
    )}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
}

export async function recordStatement(
  creditLineId: string,
  input: {
    cutoffDate: string
    dueDate: string
    closingBalanceMinor: number
    amountDueMinor: number
  },
): Promise<{ data: { statement: CreditLineStatement } }> {
  return apiFetch<{ data: { statement: CreditLineStatement } }>(
    `/credit-lines/${encodeURIComponent(creditLineId)}/statements`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}
