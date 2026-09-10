import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { z } from 'zod'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import {
  RequirePermission,
  RoleGuard,
} from '../../../../../common/guards/role.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { UpdateMemberRoleSchema } from '../../../../../common/shared-schemas'
import { MembershipService } from '../../../application/membership.service'

type UpdateMemberRoleBody = z.infer<typeof UpdateMemberRoleSchema>

/**
 * Members of the active household.
 *
 * Mounted at `/members` rather than `/tenants/{id}/members`: the tenant is
 * never addressed in the path anywhere in this API — TenantGuard resolves it
 * from the session or the `x-tenant-id` header and verifies membership before
 * the handler runs. A tenant id in the URL would be a second, unverified
 * source of the same fact.
 */
@Controller('members')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class MembersController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get()
  @RequirePermission('member:read')
  async listMembers(@Req() req: RequestContext) {
    const tenantId = req.tenantId as string
    const members = await this.membershipService.listMembers(tenantId)

    return {
      data: {
        members,
      },
    }
  }

  /**
   * Members are addressed by `userId`, not by the membership row id. The row id
   * is an internal join key that never leaves the API — see TenantMemberSchema,
   * which deliberately omits it.
   */
  @Patch(':userId')
  @RequirePermission('member:change-role')
  @UsePipes(new ZodValidationPipe(UpdateMemberRoleSchema))
  async changeRole(
    @Req() req: RequestContext,
    @Param('userId') userId: string,
    @Body() body: UpdateMemberRoleBody,
  ) {
    await this.membershipService.changeRole({
      tenantId: req.tenantId as string,
      userId,
      role: body.role,
      actorUserId: req.user?.id ?? '',
      correlationId: req.requestId ?? 'unknown',
    })

    return { data: { updated: true } }
  }

  @Delete(':userId')
  @RequirePermission('member:remove')
  async removeMember(@Req() req: RequestContext, @Param('userId') userId: string) {
    await this.membershipService.removeMember({
      tenantId: req.tenantId as string,
      userId,
      actorUserId: req.user?.id ?? '',
      correlationId: req.requestId ?? 'unknown',
    })

    return { data: { deleted: true } }
  }
}
