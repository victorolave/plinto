import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { z } from 'zod'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { CreateDemoHouseholdSchema } from '../../../../../common/shared-schemas'
import { DemoHouseholdService } from '../../../application/demo-household.service'

type CreateDemoHouseholdBody = z.infer<typeof CreateDemoHouseholdSchema>

/**
 * The example household: a separate, throwaway tenant a user can create and
 * delete on demand, filled with invented Colombian sample data.
 *
 * Mounted at `/tenants` alongside TenantsController, but `DELETE /tenants/:id`
 * deliberately addresses the tenant by id in the path — unlike every other
 * tenant-scoped endpoint in this API, this one is not about "the active
 * household" (TenantGuard's job); it names a specific household to destroy,
 * and DemoHouseholdService is what verifies the caller may destroy it.
 */
@Controller('tenants')
@UseGuards(AuthGuard)
export class DemoHouseholdController {
  constructor(private readonly demoHouseholdService: DemoHouseholdService) {}

  @Post('demo')
  @UsePipes(new ZodValidationPipe(CreateDemoHouseholdSchema))
  async createDemoHousehold(
    @Req() req: RequestContext,
    @Body() body: CreateDemoHouseholdBody,
  ) {
    const tenant = await this.demoHouseholdService.createForUser({
      userId: req.user?.id ?? '',
      locale: body.locale,
      correlationId: req.requestId ?? 'unknown',
    })

    return { data: { tenant } }
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteDemoHousehold(@Req() req: RequestContext, @Param('id') id: string) {
    await this.demoHouseholdService.deleteForUser({
      userId: req.user?.id ?? '',
      tenantId: id,
      correlationId: req.requestId ?? 'unknown',
    })
  }
}
