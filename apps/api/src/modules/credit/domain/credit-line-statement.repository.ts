import { CreditLineStatement } from './credit-line-statement.entity'

/** A statement with what its obligation has actually been paid. */
export interface CreditLineStatementWithPayment {
  statement: CreditLineStatement
  /** Sum of the transactions settling this statement's obligation. */
  paidMinor: number
}

/**
 * Port: the statement persistence contract the application layer depends on.
 *
 * `create` writes the statement AND the obligation it produces. They are one
 * fact, not two: a statement without its obligation is a bill that never
 * reaches the household's board, and a household that cannot see a bill does
 * not pay it. Only the adapter can make that atomic, so the port asks for it
 * rather than leaving the service to write twice and hope.
 */
export abstract class CreditLineStatementRepository {
  abstract create(data: {
    tenantId: string
    creditLineId: string
    lineName: string
    period: string
    cutoffDate: Date
    dueDate: Date
    closingBalanceMinor: number
    amountDueMinor: number
    limitMinorSnapshot: number
    currency: string
  }): Promise<CreditLineStatement>

  abstract findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<CreditLineStatement | null>

  abstract listForLine(
    creditLineId: string,
    tenantId: string,
  ): Promise<CreditLineStatement[]>

  /**
   * The most recent statement of each active line, which is what available
   * credit and the estimated payment are read from.
   */
  abstract listLatestPerLine(tenantId: string): Promise<CreditLineStatement[]>

  /** What the statement's obligation has been paid, aggregated in SQL. */
  abstract findWithPayment(
    id: string,
    tenantId: string,
  ): Promise<CreditLineStatementWithPayment | null>

  /**
   * Corrects a statement AND the obligation it produced, together.
   *
   * The opposite of a recurring rule, whose amount is snapshotted into each
   * instance so that editing the rule cannot rewrite history. Here the two are
   * one fact recorded once, and leaving them able to disagree would serve
   * nobody.
   */
  abstract update(
    id: string,
    tenantId: string,
    data: {
      dueDate?: Date
      closingBalanceMinor?: number
      amountDueMinor?: number
    },
  ): Promise<CreditLineStatement | null>
}
