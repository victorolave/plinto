import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { CreditLineStatement, statementObligationName } from '../domain/credit-line-statement.entity'
import {
  CreditLineStatementRepository,
  CreditLineStatementWithPayment,
} from '../domain/credit-line-statement.repository'

type RawPaidRow = { paid_minor: bigint | string | number | null }

/**
 * Prisma adapter for the CreditLineStatementRepository port. This is the only
 * unit that knows about Prisma for the statements aggregate.
 */
@Injectable()
export class PrismaCreditLineStatementRepository extends CreditLineStatementRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  /**
   * Statement and obligation in one transaction.
   *
   * A statement whose obligation failed to write is a bill the household never
   * sees on its board, and the money leaves the account anyway. Splitting this
   * into two writes would make that outcome reachable on any transient error,
   * so it is not split.
   */
  async create(data: {
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
  }): Promise<CreditLineStatement> {
    const { lineName, ...statementData } = data

    return this.prisma.$transaction(async (tx) => {
      const statement = await tx.creditLineStatement.create({ data: statementData })

      await tx.obligationInstance.create({
        data: {
          tenantId: data.tenantId,
          sourceType: 'credit_line',
          creditLineStatementId: statement.id,
          period: statement.period,
          // Straight from the statement, both of them. The issuer already
          // answered "how much" and "by when"; deriving either would be
          // inventing an answer next to the real one.
          dueDate: statement.dueDate,
          name: statementObligationName(lineName, statement.cutoffDate),
          expectedAmountMinor: statement.amountDueMinor,
          currency: statement.currency,
        },
      })

      return statement
    })
  }

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<CreditLineStatement | null> {
    return this.prisma.creditLineStatement.findFirst({ where: { id, tenantId } })
  }

  async listForLine(
    creditLineId: string,
    tenantId: string,
  ): Promise<CreditLineStatement[]> {
    return this.prisma.creditLineStatement.findMany({
      where: { creditLineId, tenantId },
      orderBy: { cutoffDate: 'desc' },
    })
  }

  /**
   * One row per line: its newest statement by cutoff.
   *
   * `DISTINCT ON` rather than loading every statement and reducing in memory —
   * a household with seven years of history on four lines would otherwise pull
   * hundreds of rows to answer a question about four.
   */
  async listLatestPerLine(tenantId: string): Promise<CreditLineStatement[]> {
    return this.prisma.$queryRaw<CreditLineStatement[]>`
      SELECT DISTINCT ON (s."credit_line_id")
        s."id",
        s."tenant_id" AS "tenantId",
        s."credit_line_id" AS "creditLineId",
        s."period",
        s."cutoff_date" AS "cutoffDate",
        s."due_date" AS "dueDate",
        s."closing_balance_minor" AS "closingBalanceMinor",
        s."amount_due_minor" AS "amountDueMinor",
        s."limit_minor_snapshot" AS "limitMinorSnapshot",
        s."currency",
        s."created_at" AS "createdAt",
        s."updated_at" AS "updatedAt"
      FROM "credit_line_statements" s
      WHERE s."tenant_id" = ${tenantId}
      ORDER BY s."credit_line_id", s."cutoff_date" DESC
    `
  }

  async findWithPayment(
    id: string,
    tenantId: string,
  ): Promise<CreditLineStatementWithPayment | null> {
    const statement = await this.findByIdForTenant(id, tenantId)

    if (!statement) {
      return null
    }

    // "Paid" has to mean here exactly what it means on the obligations board,
    // so it is read through the same join rather than defined a second time.
    const rows = await this.prisma.$queryRaw<RawPaidRow[]>`
      SELECT COALESCE(SUM(t."amount_minor"), 0) AS paid_minor
      FROM "obligation_instances" i
      JOIN "obligation_payments" op ON op."obligation_instance_id" = i."id"
      JOIN "transactions" t ON t."id" = op."transaction_id"
      WHERE i."credit_line_statement_id" = ${id}
    `

    return { statement, paidMinor: Number(rows[0]?.paid_minor ?? 0) }
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      dueDate?: Date
      closingBalanceMinor?: number
      amountDueMinor?: number
    },
  ): Promise<CreditLineStatement | null> {
    const existing = await this.findByIdForTenant(id, tenantId)

    if (!existing) {
      return null
    }

    return this.prisma.$transaction(async (tx) => {
      const statement = await tx.creditLineStatement.update({ where: { id }, data })

      // The obligation follows the statement: they are one fact recorded once.
      // `updateMany` rather than `update` because a statement recorded before
      // this column existed would have no obligation, and a missing row is not
      // an error worth failing a correction over.
      await tx.obligationInstance.updateMany({
        where: { creditLineStatementId: id },
        data: {
          dueDate: statement.dueDate,
          expectedAmountMinor: statement.amountDueMinor,
        },
      })

      return statement
    })
  }
}
