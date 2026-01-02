import { Module } from '@nestjs/common'
import { UserRepository } from './infrastructure/user.repository'
import { UserProvisioningService } from './application/user-provisioning.service'
import { UsersController } from './interfaces/http/v1/users.controller'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuthGuard } from '../../common/guards/auth.guard'

@Module({
  imports: [MembershipsModule, SessionsModule],
  controllers: [UsersController],
  providers: [UserRepository, UserProvisioningService, AuthGuard],
  exports: [UserRepository, UserProvisioningService],
})
export class UsersModule {}
