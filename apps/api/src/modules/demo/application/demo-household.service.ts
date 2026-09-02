import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { AuditService } from '../../audit/application/audit.service'
import { MembershipRepository } from '../../memberships/domain/membership.repository'
import { SessionRepository } from '../../sessions/domain/session.repository'
import { SessionService } from '../../sessions/application/session.service'
import { Tenant } from '../../tenants/domain/tenant.entity'
import { TenantRepository } from '../../tenants/domain/tenant.repository'
import { DemoLocale } from '../domain/demo-household-dataset'
import { DemoHouseholdRepository } from '../domain/demo-household.repository'

const DEMO_TENANT_NAME: Record<DemoLocale, string> = {
  es: 'Hogar de ejemplo',
  en: 'Example household',
}

/**
 * Creates and tears down the example household: a separate, clearly-labelled
 * tenant filled with invented Colombian sample data, for the current user to
 * explore Plinto without touching their real household.
 */
@Injectable()
export class DemoHouseholdService {
  private readonly logger = new Logger(DemoHouseholdService.name)

  constructor(
    private readonly demoHouseholdRepository: DemoHouseholdRepository,
    private readonly tenantRepository: TenantRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly sessionService: SessionService,
    private readonly sessionRepository: SessionRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Creates one example household for `userId` and immediately switches
   * their active tenant to it — the household is useless if the person has
   * to go find it in the switcher right after asking for it.
   *
   * One demo household per user at a time: asking twice without deleting the
   * first is a conflict, not a second household.
   */
  async createForUser(params: {
    userId: string
    locale?: DemoLocale
    correlationId: string
    now?: Date
  }): Promise<Tenant> {
    const existing = await this.tenantRepository.findDemoTenantForOwner(params.userId)
    if (existing) {
      throw new ConflictException({
        code: 'DEMO_TENANT_EXISTS',
        message: 'You already have an example household. Delete it before creating a new one.',
      })
    }

    const locale = params.locale ?? 'es'
    const now = params.now ?? new Date()

    const { tenant } = await this.demoHouseholdRepository.createDemoHousehold({
      ownerUserId: params.userId,
      tenantName: DEMO_TENANT_NAME[locale],
      locale,
      now,
    })

    await this.sessionService.setActiveTenant(params.userId, tenant.id)

    await this.auditService.record({
      tenantId: tenant.id,
      actorUserId: params.userId,
      action: 'tenant.demo.created',
      resourceType: 'tenant',
      resourceId: tenant.id,
      correlationId: params.correlationId,
    })

    return tenant
  }

  /**
   * Deletes the example household named by `tenantId`, and only that: a real
   * household must never be reachable through this path, regardless of who
   * asks, which is why `TENANT_NOT_DEMO` is checked before ownership.
   */
  async deleteForUser(params: {
    userId: string
    tenantId: string
    correlationId: string
  }): Promise<void> {
    const tenant = await this.tenantRepository.findById(params.tenantId)
    if (!tenant) {
      throw new NotFoundException('That household no longer exists.')
    }
    if (!tenant.isDemo) {
      throw new ConflictException({
        code: 'TENANT_NOT_DEMO',
        message: 'Only the example household can be deleted this way.',
      })
    }

    const membership = await this.membershipRepository.findByUserAndTenant(
      params.userId,
      params.tenantId,
    )
    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenException('Only the owner can delete the example household.')
    }

    await this.demoHouseholdRepository.deleteDemoHousehold(params.tenantId)

    // Best-effort: the deletion itself already succeeded and is what the
    // caller asked for. The FK also sets this NULL at the database level;
    // this is for callers reading their own session synchronously right after.
    try {
      await this.sessionRepository.clearActiveTenantForUser(params.userId, params.tenantId)
    } catch (error) {
      this.logger.error(
        `Deleted example household ${params.tenantId} but failed to clear active tenant for ${params.userId}: ${error}`,
      )
    }

    this.logger.log(`Deleted example household ${params.tenantId} for user ${params.userId}`)
  }
}
