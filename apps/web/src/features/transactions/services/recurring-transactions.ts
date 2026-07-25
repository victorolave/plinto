import { apiFetch } from '../../../lib/api/client'
import type { TransactionType } from './transactions'

/**
 * A rule sits in exactly one lifecycle state. Only `active` rules are posted
 * by the execution job; `paused` is reversible and `archived` is retirement
 * (restorable — rules are never deleted, so their history survives).
 */
export type RecurringRuleStatus = 'active' | 'paused' | 'archived'

export interface RecurringTransactionRule {
  id: string
  tenantId: string
  accountId: string
  name: string
  type: TransactionType
  amountMinor: number
  currency: string
  frequency: 'monthly'
  dayOfMonth: number
  startDate: string
  status: RecurringRuleStatus
  createdAt: string
  updatedAt: string
}

type RuleResponse = Promise<{ data: { rule: RecurringTransactionRule } }>

export async function listRecurringTransactionRules(
  options: { includeArchived?: boolean } = {},
): Promise<{ data: { rules: RecurringTransactionRule[] } }> {
  const query = options.includeArchived ? '?includeArchived=true' : ''
  return apiFetch<{ data: { rules: RecurringTransactionRule[] } }>(
    `/recurring-transactions${query}`,
  )
}

export async function createRecurringTransactionRule(input: {
  name: string
  accountId: string
  type: TransactionType
  amountMinor: number
  dayOfMonth: number
  startDate: string
  status?: Exclude<RecurringRuleStatus, 'archived'>
}): RuleResponse {
  return apiFetch<{ data: { rule: RecurringTransactionRule } }>('/recurring-transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Only these four fields are editable. The account, type, currency and
 * frequency are frozen server-side because past periods are already
 * materialized as transactions carrying those values.
 */
export async function updateRecurringTransactionRule(
  id: string,
  input: {
    name?: string
    amountMinor?: number
    dayOfMonth?: number
    startDate?: string
  },
): RuleResponse {
  return ruleAction(id, '', { method: 'PATCH', body: JSON.stringify(input) })
}

/** Stops the job from posting this rule. Reversible via resume. */
export async function pauseRecurringTransactionRule(id: string): RuleResponse {
  return ruleAction(id, '/pause', { method: 'POST' })
}

/** Puts the rule back in the job's hands. Rejected for archived rules. */
export async function resumeRecurringTransactionRule(id: string): RuleResponse {
  return ruleAction(id, '/resume', { method: 'POST' })
}

/**
 * Comes back as paused, never active — a restored rule must not post money on
 * the next job run without someone deciding that it should.
 */
export async function restoreRecurringTransactionRule(id: string): RuleResponse {
  return ruleAction(id, '/restore', { method: 'POST' })
}

/** Soft-delete: the rule is retired, its executions and history are kept. */
export async function archiveRecurringTransactionRule(id: string): RuleResponse {
  return ruleAction(id, '', { method: 'DELETE' })
}

function ruleAction(id: string, suffix: string, init: RequestInit): RuleResponse {
  return apiFetch<{ data: { rule: RecurringTransactionRule } }>(
    `/recurring-transactions/${encodeURIComponent(id)}${suffix}`,
    init,
  )
}
