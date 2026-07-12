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
import { TenantService } from '../../../application/tenant.service'

@Controller('tenants')
@UseGuards(AuthGuard)
export class TenantsController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly tenantService: TenantService,
  ) {}

  @Get()
  async listTenants(@Req() req: RequestContext) {
    const userId = req.user?.id ?? ''
    const { tenants, memberships } = await this.tenantService.listTenantsForUser(userId)

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
