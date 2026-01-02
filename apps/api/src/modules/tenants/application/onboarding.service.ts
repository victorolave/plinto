import { BadRequestException, Injectable } from '@nestjs/common'
import { DEFAULT_BASE_CURRENCY } from '../../../config/constants'
import { AuditService } from '../../audit/application/audit.service'
import { MembershipRepository } from '../../memberships/infrastructure/membership.repository'
import { UserRepository } from '../../users/infrastructure/user.repository'
import { SessionService } from '../../sessions/application/session.service'
import { TenantRepository } from '../infrastructure/tenant.repository'

@Injectable()
export class OnboardingService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tenantRepository: TenantRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly auditService: AuditService,
    private readonly sessionService: SessionService,
  ) {}

  async completeOnboarding(params: {
    userId: string
    profileName?: string
    tenantName: string
    baseCurrency?: string
    requestId: string
  }) {
    if (params.profileName) {
      await this.userRepository.updateName(params.userId, params.profileName)
    }

    const user = await this.userRepository.findById(params.userId)
    if (!user?.name) {
      throw new BadRequestException({
        code: 'PROFILE_REQUIRED',
        message: 'Profile name is required before creating a tenant.',
      })
    }

    const trimmedCurrency = params.baseCurrency?.trim()
    const tenant = await this.tenantRepository.create({
      name: params.tenantName,
      baseCurrency: trimmedCurrency ? trimmedCurrency : DEFAULT_BASE_CURRENCY,
    })

    const membership = await this.membershipRepository.create({
      tenantId: tenant.id,
      userId: params.userId,
      role: 'owner',
    })

    await this.sessionService.setActiveTenant(params.userId, tenant.id)

    await this.auditService.record({
      tenantId: tenant.id,
      actorUserId: params.userId,
      action: 'tenant.create',
      resourceType: 'tenant',
      resourceId: tenant.id,
      correlationId: params.requestId,
    })

    await this.auditService.record({
      tenantId: tenant.id,
      actorUserId: params.userId,
      action: 'membership.create',
      resourceType: 'membership',
      resourceId: membership.id,
      correlationId: params.requestId,
    })

    return { tenant, membership }
  }
}
