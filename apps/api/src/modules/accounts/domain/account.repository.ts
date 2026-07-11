import { Account, AccountType } from './account.entity'

/**
 * Port: the account persistence contract the application layer depends on.
 * Adapters (e.g. PrismaAccountRepository) live in the infrastructure layer and
 * implement this abstract class, which doubles as the DI token — so the ORM can
 * be swapped by binding a different adapter without touching business logic.
 */
export abstract class AccountRepository {
  abstract create(data: {
    tenantId: string
    name: string
    type: AccountType
    currency: string
  }): Promise<Account>

  abstract listByTenantId(
    tenantId: string,
    options?: { includeArchived?: boolean },
  ): Promise<Account[]>

  abstract findByIdForTenant(id: string, tenantId: string): Promise<Account | null>

  abstract updateForTenant(
    id: string,
    tenantId: string,
    data: { name?: string; type?: AccountType },
  ): Promise<Account | null>

  abstract archiveForTenant(
    id: string,
    tenantId: string,
    archivedAt: Date,
  ): Promise<Account | null>

  abstract restoreForTenant(id: string, tenantId: string): Promise<Account | null>
}
