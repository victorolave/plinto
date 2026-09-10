import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import {
  HouseholdExportData,
  HouseholdExportRepository,
  TransactionCsvRow,
} from '../domain/household-export.entity'

/** Every list query orders the same way: creation order, then id as a tiebreaker for rows created in the same instant. */
const CREATED_ORDER = [{ createdAt: 'asc' as const }, { id: 'asc' as const }]

/**
 * Prisma adapter for the HouseholdExportRepository port. Every query is
 * scoped to `tenantId` and ordered `createdAt asc, id asc` (or `occurredAt`
 * for transactions), so the bundle and the CSV are deterministic across
 * re-runs — a repeat export of an unchanged household is byte-identical.
 */
@Injectable()
export class PrismaHouseholdExportRepository extends HouseholdExportRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async getHouseholdData(tenantId: string): Promise<HouseholdExportData | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, baseCurrency: true, createdAt: true },
    })

    if (!tenant) {
      return null
    }

    const [
      memberships,
      categories,
      accounts,
      creditLines,
      creditLineStatements,
      debtSchedules,
      recurringRules,
      transfers,
      transactions,
      recurringExecutions,
      obligationInstances,
      obligationPayments,
      auditEvents,
    ] = await Promise.all([
      this.prisma.membership.findMany({
        where: { tenantId },
        orderBy: CREATED_ORDER,
        include: { user: { select: { email: true, name: true } } },
      }),
      this.prisma.category.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
      this.prisma.account.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
      this.prisma.creditLine.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
      this.prisma.creditLineStatement.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
      this.prisma.debtSchedule.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
      this.prisma.recurringTransactionRule.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
      this.prisma.transfer.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
      this.prisma.transaction.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
      this.prisma.recurringTransactionExecution.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
      this.prisma.obligationInstance.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
      this.prisma.obligationPayment.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
      this.prisma.auditEvent.findMany({ where: { tenantId }, orderBy: CREATED_ORDER }),
    ])

    return {
      tenant,
      members: memberships.map((membership) => ({
        userId: membership.userId,
        email: membership.user.email,
        name: membership.user.name,
        role: membership.role,
        createdAt: membership.createdAt,
      })),
      categories,
      accounts,
      creditLines,
      creditLineStatements,
      debtSchedules,
      recurringRules,
      transfers: transfers.map((transfer) => ({
        ...transfer,
        fxRate: transfer.fxRate != null ? transfer.fxRate.toString() : null,
      })),
      transactions,
      recurringExecutions,
      obligationInstances,
      obligationPayments,
      auditEvents,
    }
  }

  async listTransactionsForCsv(tenantId: string): Promise<TransactionCsvRow[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: { tenantId },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } },
        recurringRule: { select: { name: true } },
        obligationPayment: { include: { obligationInstance: { select: { name: true } } } },
      },
    })

    return transactions.map((transaction) => ({
      occurredAt: transaction.occurredAt,
      type: transaction.type,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      accountName: transaction.account.name,
      categoryName: transaction.category?.name ?? null,
      description: transaction.description,
      source: transaction.source,
      transferId: transaction.transferId,
      recurringRuleName: transaction.recurringRule?.name ?? null,
      obligationName: transaction.obligationPayment?.obligationInstance.name ?? null,
    }))
  }

  async getTenantName(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    })

    return tenant?.name ?? null
  }
}
