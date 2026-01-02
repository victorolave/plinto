import { Module } from '@nestjs/common'
import { AuthController } from './interfaces/http/v1/auth.controller'
import { AuthService } from './application/auth.service'
import { UsersModule } from '../users/users.module'
import { SessionsModule } from '../sessions/sessions.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { AuthGuard } from '../../common/guards/auth.guard'

@Module({
  imports: [UsersModule, SessionsModule, MembershipsModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
