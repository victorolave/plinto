import { Membership } from '../../memberships/domain/membership.entity'
import { Tenant } from '../../tenants/domain/tenant.entity'
import { DemoLocale } from './demo-household-dataset'

/**
 * Thrown by `createDemoHousehold` when the owning user already has a demo
 * tenant at the point the transaction's own re-check runs — including the
 * case where a concurrent call created one after the service's own
 * fast-path check passed. The service maps this to 409 `DEMO_TENANT_EXISTS`.
 */
export class DemoTenantAlreadyExistsError extends Error {
  constructor(readonly userId: string) {
    super(`User ${userId} already owns an example household`)
    this.name = 'DemoTenantAlreadyExistsError'
  }
}

/**
 * Port: creates and tears down the example household as a whole aggregate —
 * tenant, membership and every seeded row together — the way OnboardingService
 * creates a real tenant, but as a single unit rather than separate calls,
 * because a partially-written demo household is worse than no demo at all.
 */
export abstract class DemoHouseholdRepository {
  /**
   * Serialises concurrent calls for the same `ownerUserId` with a
   * transaction-scoped Postgres advisory lock, re-checks "does this user
   * already own a demo tenant" under that lock, and only then creates one —
   * so two requests racing each other can never both pass the check and
   * both create a tenant. Throws {@link DemoTenantAlreadyExistsError} when
   * the re-check finds one, whether it existed before the call or was
   * created by a concurrent call that won the lock first.
   */
  abstract createDemoHousehold(params: {
    ownerUserId: string
    tenantName: string
    locale: DemoLocale
    now: Date
  }): Promise<{ tenant: Tenant; membership: Membership }>

  /** Deletes every tenant-scoped row for `tenantId`, then the tenant itself. */
  abstract deleteDemoHousehold(tenantId: string): Promise<void>
}
