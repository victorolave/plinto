import { Category } from './category.entity'
import { TransactionType } from '../../transactions/domain/transaction.entity'

/**
 * Port: the category persistence contract the application layer depends on.
 * Adapters (e.g. PrismaCategoryRepository) live in the infrastructure layer
 * and implement this abstract class, which doubles as the DI token — so the
 * ORM can be swapped by binding a different adapter without touching
 * business logic.
 */
export abstract class CategoryRepository {
  abstract create(data: {
    tenantId: string
    name: string
    type: TransactionType
    color?: string | null
  }): Promise<Category>

  abstract listByTenantId(tenantId: string): Promise<Category[]>

  abstract findByIdForTenant(id: string, tenantId: string): Promise<Category | null>

  abstract updateForTenant(
    id: string,
    tenantId: string,
    data: Partial<{ name: string; color: string | null }>,
  ): Promise<Category | null>

  abstract deleteForTenant(id: string, tenantId: string): Promise<number>
}
