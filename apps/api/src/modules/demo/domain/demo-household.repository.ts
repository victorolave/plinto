import { Membership } from '../../memberships/domain/membership.entity'
import { Tenant } from '../../tenants/domain/tenant.entity'
import { DemoLocale } from './demo-household-dataset'

/**
 * Port: creates and tears down the example household as a whole aggregate —
 * tenant, membership and every seeded row together — the way OnboardingService
 * creates a real tenant, but as a single unit rather than separate calls,
 * because a partially-written demo household is worse than no demo at all.
 */
export abstract class DemoHouseholdRepository {
  abstract createDemoHousehold(params: {
    ownerUserId: string
    tenantName: string
    locale: DemoLocale
    now: Date
  }): Promise<{ tenant: Tenant; membership: Membership }>

  /** Deletes every tenant-scoped row for `tenantId`, then the tenant itself. */
  abstract deleteDemoHousehold(tenantId: string): Promise<void>
}
