import { Module } from '@nestjs/common'
import { MembershipsModule } from './memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { InvitationsModule } from '../invitations/invitations.module'
import { AuditModule } from '../audit/audit.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'
import { MembershipService } from './application/membership.service'
import { MembersController } from './interfaces/http/v1/members.controller'
import { InvitationsController } from '../invitations/interfaces/http/v1/invitations.controller'

/**
 * The HTTP surface over memberships, deliberately a second module rather than
 * controllers added to `MembershipsModule`.
 *
 * `SessionsModule` already imports `MembershipsModule` — its guards need the
 * membership repository — so having `MembershipsModule` import `SessionsModule`
 * back for `TenantGuard` would close a cycle and force a `forwardRef`. Keeping
 * `MembershipsModule` a leaf that provides only the repository port, and
 * putting the application and interface layers here, means the dependency graph
 * stays acyclic without a workaround.
 */
@Module({
  imports: [MembershipsModule, SessionsModule, InvitationsModule, AuditModule],
  controllers: [MembersController, InvitationsController],
  providers: [MembershipService, AuthGuard, TenantGuard, RoleGuard],
  exports: [MembershipService],
})
export class MembersModule {}
