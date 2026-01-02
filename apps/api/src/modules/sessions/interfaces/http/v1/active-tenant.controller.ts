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
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import { RoleGuard, RequirePermission } from '../../../../../common/guards/role.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { SelectTenantSchema } from '../../../../../common/shared-schemas'
import { SessionService } from '../../../application/session.service'

@Controller('tenants/active')
export class ActiveTenantController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  @UseGuards(AuthGuard)
  async getActiveTenant(@Req() req: RequestContext) {
    const userId = req.user?.id ?? ''
    const activeTenantId = await this.sessionService.getActiveTenant(userId)
    return {
      data: {
        activeTenantId,
      },
    }
  }

  @Post()
  @UseGuards(AuthGuard, TenantGuard, RoleGuard)
  @RequirePermission('tenant:manage')
  @UsePipes(new ZodValidationPipe(SelectTenantSchema))
  async setActiveTenant(
    @Req() req: RequestContext,
    @Body() body: { tenantId: string },
  ) {
    await this.sessionService.setActiveTenant(req.user?.id ?? '', body.tenantId)
    return {
      data: {
        activeTenantId: body.tenantId,
      },
    }
  }
}
