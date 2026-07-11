export interface ExpenseCategoryGroup {
  categoryId: string
  currency: string
  totalMinor: number
}

/**
 * Port: the report persistence contract the application layer depends on.
 * Adapters (e.g. PrismaReportRepository) live in the infrastructure layer
 * and implement this abstract class, which doubles as the DI token — so the
 * ORM can be swapped by binding a different adapter without touching
 * business logic.
 */
export abstract class ReportRepository {
  abstract sumExpensesByCategory(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<ExpenseCategoryGroup[]>

  abstract findCategoryNamesByIds(
    tenantId: string,
    ids: string[],
  ): Promise<Array<{ id: string; name: string }>>
}
