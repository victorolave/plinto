/**
 * Kept in step with the `ObligationSourceType` enum in schema.prisma and with
 * `ObligationSourceTypeSchema` in @plinto/shared. `debt_schedule` arrives with
 * PRD-007 and `credit_line` with PRD-011; the database's CHECK constraint pins
 * which reference each origin must carry.
 */
export type ObligationSourceType =
  | 'recurring_rule'
  | 'manual'
  | 'debt_schedule'
  | 'credit_line'

/**
 * Reported state of an obligation. Never persisted: it is a projection over
 * the payments and the due date, so it cannot contradict the facts that back
 * it, and instances age into `overdue` on their own without a job.
 */
export type ObligationStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export interface ObligationPayment {
  id: string
  tenantId: string
  obligationInstanceId: string
  transactionId: string
  amountMinor: number
  currency: string
  occurredAt: Date
  createdAt: Date
}

export interface ObligationInstance {
  id: string
  tenantId: string
  sourceType: ObligationSourceType
  recurringRuleId: string | null
  period: string
  dueDate: Date
  name: string
  expectedAmountMinor: number
  currency: string
  createdAt: Date
  updatedAt: Date
  payments: ObligationPayment[]
}

/** An obligation plus the state derived from its payments. */
export interface ResolvedObligationInstance extends ObligationInstance {
  status: ObligationStatus
  paidAmountMinor: number
  outstandingAmountMinor: number
}

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

export function sumPaidAmountMinor(payments: ObligationPayment[]): number {
  return payments.reduce((total, payment) => total + payment.amountMinor, 0)
}

/**
 * Derives the reported state from the payments and the due date.
 *
 * An overpayment still counts as `paid` rather than a state of its own: the
 * household settled the obligation, and the surplus is a fact about the
 * transaction, not about the obligation. `outstandingAmountMinor` is floored at
 * zero for the same reason — a negative "still owed" would leak into the period
 * totals and understate the real shortfall of the other obligations.
 *
 * Precedence is `paid` > `overdue` > `partial` > `pending`. `paid` wins so a
 * settled obligation is never flagged overdue merely because it was paid late.
 * `overdue` wins over `partial` because a half-paid bill that is already late
 * is a late bill: the urgency is what the household needs to see, and the
 * partial payment is still visible in `paidAmountMinor`.
 */
export function resolveObligationInstance(
  instance: ObligationInstance,
  now: Date,
): ResolvedObligationInstance {
  const paidAmountMinor = sumPaidAmountMinor(instance.payments)
  const outstandingAmountMinor = Math.max(
    instance.expectedAmountMinor - paidAmountMinor,
    0,
  )

  return {
    ...instance,
    paidAmountMinor,
    outstandingAmountMinor,
    status: deriveStatus(instance, paidAmountMinor, now),
  }
}

function deriveStatus(
  instance: ObligationInstance,
  paidAmountMinor: number,
  now: Date,
): ObligationStatus {
  if (paidAmountMinor >= instance.expectedAmountMinor) {
    return 'paid'
  }

  if (instance.dueDate.getTime() < now.getTime()) {
    return 'overdue'
  }

  return paidAmountMinor > 0 ? 'partial' : 'pending'
}
