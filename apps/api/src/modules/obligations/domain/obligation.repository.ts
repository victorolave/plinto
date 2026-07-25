import {
  ObligationCurrencyTotal,
  ObligationInstance,
  ObligationPayment,
} from './obligation.entity'

export interface CreateObligationInstanceInput {
  tenantId: string
  sourceType: 'recurring_rule' | 'manual'
  recurringRuleId: string | null
  period: string
  dueDate: Date
  name: string
  expectedAmountMinor: number
  currency: string
}

/** Expected totals for a period, already grouped by currency in SQL. */
export interface ObligationExpectedTotal {
  currency: string
  expectedMinor: number
}

/** Settled totals for a period, already grouped by currency in SQL. */
export interface ObligationPaidTotal {
  currency: string
  paidMinor: number
}

/**
 * Port: the obligation persistence contract the application layer depends on.
 * Adapters (e.g. PrismaObligationRepository) live in the infrastructure layer
 * and implement this abstract class, which doubles as the DI token — so the
 * ORM can be swapped by binding a different adapter without touching business
 * logic.
 */
export abstract class ObligationRepository {
  abstract createInstance(
    input: CreateObligationInstanceInput,
  ): Promise<ObligationInstance>

  /**
   * Creates an instance materialized from a recurring rule. Returns null when
   * one already exists for that (rule, period) — whether the caller's prior
   * check saw it or a concurrent job won the race against the unique
   * constraint. Callers must treat null as "already generated" (skip), not as
   * an error, the same way the recurring executor does.
   */
  abstract createGeneratedInstance(
    input: CreateObligationInstanceInput & { recurringRuleId: string },
  ): Promise<ObligationInstance | null>

  abstract findInstanceByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<ObligationInstance | null>

  abstract listInstancesByPeriod(
    tenantId: string,
    period: string,
  ): Promise<ObligationInstance[]>

  /** Rule ids already materialized for a period, used to skip regeneration. */
  abstract listGeneratedRuleIdsForPeriod(
    tenantId: string,
    period: string,
  ): Promise<string[]>

  abstract createPayment(input: {
    tenantId: string
    obligationInstanceId: string
    transactionId: string
  }): Promise<ObligationPayment>

  /**
   * Looks up the payment that already claims a transaction, so a double
   * reconciliation can be reported as a conflict instead of surfacing the raw
   * unique-constraint violation.
   */
  abstract findPaymentByTransactionId(
    tenantId: string,
    transactionId: string,
  ): Promise<ObligationPayment | null>

  abstract deletePayment(
    tenantId: string,
    obligationInstanceId: string,
    transactionId: string,
  ): Promise<boolean>

  /**
   * Aggregates the period's expected and settled amounts per currency. Both
   * run in SQL — never by loading instances into application memory — and both
   * group by currency rather than returning a scalar, because summing across
   * currencies is arithmetic on incomparable units.
   */
  abstract sumExpectedByCurrency(
    tenantId: string,
    period: string,
  ): Promise<ObligationExpectedTotal[]>

  abstract sumPaidByCurrency(
    tenantId: string,
    period: string,
  ): Promise<ObligationPaidTotal[]>
}

export type { ObligationCurrencyTotal }
