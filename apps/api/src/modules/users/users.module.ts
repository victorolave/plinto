import { Module } from '@nestjs/common'
import { UserRepository } from './domain/user.repository'
import { PrismaUserRepository } from './infrastructure/prisma-user.repository'
import { UserProvisioningService } from './application/user-provisioning.service'
import { UserProfileService } from './application/user-profile.service'
import { UsersController } from './interfaces/http/v1/users.controller'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuditModule } from '../audit/audit.module'
import { AuthGuard } from '../../common/guards/auth.guard'

@Module({
  imports: [MembershipsModule, SessionsModule, AuditModule],
  controllers: [UsersController],
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    UserProvisioningService,
    UserProfileService,
    AuthGuard,
  ],
  exports: [UserRepository, UserProvisioningService, UserProfileService],
})
export class UsersModule {}
