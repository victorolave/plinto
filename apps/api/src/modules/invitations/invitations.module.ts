import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { UsersModule } from '../users/users.module'
import { InvitationRepository } from './domain/invitation.repository'
import { PrismaInvitationRepository } from './infrastructure/prisma-invitation.repository'
import { InvitationService } from './application/invitation.service'

/**
 * Provides the invitation aggregate and the service over it, without any HTTP
 * of its own.
 *
 * The controller lives in MembersModule instead, for the same reason
 * MembersModule exists at all: the guard chain needs SessionsModule, and
 * SessionsModule already imports MembershipsModule. Keeping the modules that
 * own repositories free of that dependency is what stops the graph closing on
 * itself.
 *
 * AuthModule imports this one to claim invitations at login, which is safe in
 * that direction — nothing here reaches back to auth.
 */
@Module({
  imports: [MembershipsModule, UsersModule, AuditModule],
  providers: [
    { provide: InvitationRepository, useClass: PrismaInvitationRepository },
    InvitationService,
  ],
  exports: [InvitationService, InvitationRepository],
})
export class InvitationsModule {}
