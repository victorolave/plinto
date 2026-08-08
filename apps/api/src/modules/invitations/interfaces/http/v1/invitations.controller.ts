import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
import { CreateInvitationSchema } from '../../../../../common/shared-schemas'
import { InvitationService } from '../../../application/invitation.service'

type CreateInvitationBody = z.infer<typeof CreateInvitationSchema>

/**
 * Invitations to the active household.
 *
 * Mounted under `/members` because that is what an invitation is on its way to
 * becoming, and because the tenant is never addressed in a path here —
 * TenantGuard resolves it from the session or the `x-tenant-id` header.
 *
 * Every route requires `member:invite`, which the policy grants to owners
 * alone: reading the roster is everyone's business, changing who is on it is
 * not.
 */
@Controller('members/invitations')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class InvitationsController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get()
  @RequirePermission('member:invite')
  async listInvitations(@Req() req: RequestContext) {
    const tenantId = req.tenantId as string
    const invitations = await this.invitationService.listPending(tenantId)

    return { data: { invitations } }
  }

  @Post()
  @RequirePermission('member:invite')
  @UsePipes(new ZodValidationPipe(CreateInvitationSchema))
  async createInvitation(
    @Req() req: RequestContext,
    @Body() body: CreateInvitationBody,
  ) {
    const result = await this.invitationService.invite({
      tenantId: req.tenantId as string,
      email: body.email,
      role: body.role,
      invitedByUserId: req.user?.id ?? '',
      correlationId: req.requestId ?? 'unknown',
    })

    return { data: result }
  }

  @Delete(':id')
  @RequirePermission('member:invite')
  async revokeInvitation(@Req() req: RequestContext, @Param('id') id: string) {
    await this.invitationService.revoke({
      invitationId: id,
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? '',
      correlationId: req.requestId ?? 'unknown',
    })

    return { data: { deleted: true } }
  }
}
