import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { ExpenseByCategoryItemDto } from '@plinto/shared'

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getExpensesByCategory(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<ExpenseByCategoryItemDto[]> {
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

    if (rows.length === 0) {
      return []
    }

    // Collect distinct category IDs.
    // The groupBy where clause guarantees categoryId is not null, but Prisma's
    // inferred type still includes null because the column is nullable.
    // We filter and cast here — the runtime guarantee is from the WHERE clause above.
    const distinctCategoryIds = [
      ...new Set(
        rows
          .map((r) => r.categoryId)
          .filter((id): id is string => id !== null),
      ),
    ]

    // Include tenantId in the where clause to prevent cross-tenant name leakage.
    const categories = await this.prisma.category.findMany({
      where: { tenantId, id: { in: distinctCategoryIds } },
      select: { id: true, name: true },
    })

    const nameById = new Map(categories.map((c) => [c.id, c.name]))

    return rows.map((row) => {
      // categoryId is guaranteed non-null by the WHERE clause; cast with comment
      const categoryId = row.categoryId as string // guaranteed by categoryId:{not:null} filter
      return {
        categoryId,
        categoryName: nameById.get(categoryId) ?? 'Unknown',
        currency: row.currency,
        totalMinor: row._sum.amountMinor ?? 0,
      }
    })
  }
}
