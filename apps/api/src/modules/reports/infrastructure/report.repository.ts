import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'

export interface ExpenseCategoryGroup {
  categoryId: string
  currency: string
  totalMinor: number
}

@Injectable()
export class ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregates expense totals grouped by category and currency for a tenant.
   * Aggregation happens in SQL (groupBy + _sum) — never in application memory.
   * Rows with a null categoryId are excluded by the WHERE clause and filtered
   * out here so the returned shape carries a guaranteed non-null categoryId.
   */
  async sumExpensesByCategory(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<ExpenseCategoryGroup[]> {
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId', 'currency'],
      where: {
        tenantId,
        type: 'expense',
        categoryId: { not: null },
        occurredAt: { gte: from, lte: to },
      },
      _sum: { amountMinor: true },
    })

    return rows
      .filter((row): row is typeof row & { categoryId: string } => row.categoryId !== null)
      .map((row) => ({
        categoryId: row.categoryId,
        currency: row.currency,
        totalMinor: row._sum.amountMinor ?? 0,
      }))
  }

  /**
   * Resolves category names for the given ids, scoped to the tenant to prevent
   * cross-tenant name leakage. Returns an empty array when no ids are requested.
   */
  async findCategoryNamesByIds(
    tenantId: string,
    ids: string[],
  ): Promise<Array<{ id: string; name: string }>> {
    if (ids.length === 0) {
      return []
    }

    return this.prisma.category.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, name: true },
    })
  }
}
