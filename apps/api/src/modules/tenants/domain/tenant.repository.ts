import { Tenant } from './tenant.entity'

/**
 * Port: the tenant persistence contract the application layer depends on.
 * Adapters (e.g. PrismaTenantRepository) live in the infrastructure layer
 * and implement this abstract class, which doubles as the DI token — so the
 * ORM can be swapped by binding a different adapter without touching
 * business logic.
 */
export abstract class TenantRepository {
  abstract create(data: { name: string; baseCurrency: string }): Promise<Tenant>

  abstract findById(id: string): Promise<Tenant | null>

  abstract listByUserId(userId: string): Promise<Tenant[]>
}
