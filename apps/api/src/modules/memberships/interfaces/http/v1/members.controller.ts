import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import {
  RequirePermission,
  RoleGuard,
} from '../../../../../common/guards/role.guard'
import { MembershipService } from '../../../application/membership.service'

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
}
