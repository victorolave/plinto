import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { CreateTenantSchema } from '../../../../../common/shared-schemas'
import { OnboardingService } from '../../../application/onboarding.service'
import { TenantRepository } from '../../../infrastructure/tenant.repository'
import { MembershipRepository } from '../../../../memberships/infrastructure/membership.repository'

@Controller('tenants')
@UseGuards(AuthGuard)
export class TenantsController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly tenantRepository: TenantRepository,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  @Get()
  async listTenants(@Req() req: RequestContext) {
    const userId = req.user?.id ?? ''
    const tenants = await this.tenantRepository.listByUserId(userId)
    const memberships = await this.membershipRepository.listByUserId(userId)

    return {
      data: {
        tenants,
        memberships,
      },
    }
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateTenantSchema))
  async createTenant(
    @Req() req: RequestContext,
    @Body() body: { name: string; baseCurrency?: string },
  ) {
    const userId = req.user?.id ?? ''
    const requestId = req.requestId ?? 'unknown'

    const result = await this.onboardingService.completeOnboarding({
      userId,
      tenantName: body.name,
      baseCurrency: body.baseCurrency,
      requestId,
    })

    return {
      data: {
        tenant: result.tenant,
        membership: result.membership,
      },
    }
  }
}
