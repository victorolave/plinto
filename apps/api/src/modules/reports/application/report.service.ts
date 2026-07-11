import { Injectable } from '@nestjs/common'
import { ExpenseByCategoryItemDto } from '@plinto/shared'
import { ReportRepository } from '../domain/report.repository'

@Injectable()
export class ReportService {
  constructor(private readonly reportRepository: ReportRepository) {}

  async getExpensesByCategory(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<ExpenseByCategoryItemDto[]> {
    const groups = await this.reportRepository.sumExpensesByCategory(tenantId, from, to)

    if (groups.length === 0) {
      return []
    }

    const distinctCategoryIds = [...new Set(groups.map((group) => group.categoryId))]
    const categories = await this.reportRepository.findCategoryNamesByIds(
      tenantId,
      distinctCategoryIds,
    )
    const nameById = new Map(categories.map((category) => [category.id, category.name]))

    return groups.map((group) => ({
      categoryId: group.categoryId,
      categoryName: nameById.get(group.categoryId) ?? 'Unknown',
      currency: group.currency,
      totalMinor: group.totalMinor,
    }))
  }
}
