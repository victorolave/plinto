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

/** Period totals for one currency, already aggregated in SQL. */
export interface ObligationCurrencyTotalRow {
  currency: string
  expectedMinor: number
  paidMinor: number
  outstandingMinor: number
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

  /**
   * Links a transaction to an obligation. Returns null when the transaction is
   * already claimed — the global unique index on transaction_id firing because
   * a concurrent caller reconciled it between the service's check and this
   * insert. Callers must surface that as a conflict, not a 500.
   */
  abstract createPayment(input: {
    tenantId: string
    obligationInstanceId: string
    transactionId: string
  }): Promise<ObligationPayment | null>

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
   * The period's expected, settled and outstanding totals, one row per
   * currency — never a scalar, because summing across currencies is arithmetic
   * on incomparable units.
   *
   * Outstanding is the SUM of each obligation's own shortfall, not the
   * difference between the totals. Those diverge as soon as anything is
   * overpaid: 230k expected / 250k paid alongside 100k expected / 0 paid still
   * leaves 100k owed, while subtracting the totals reports 80k. Overpayment is
   * ordinary — a rounded transfer, a late fee, rent paid together with the
   * building fee — and the error always understates what the household owes.
   */
  abstract summarizeByCurrency(
    tenantId: string,
    period: string,
  ): Promise<ObligationCurrencyTotalRow[]>
}

export type { ObligationCurrencyTotal }
