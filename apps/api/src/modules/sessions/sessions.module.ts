import { Module } from '@nestjs/common'
import { SessionRepository } from './infrastructure/session.repository'
import { SessionService } from './application/session.service'
import { ActiveTenantController } from './interfaces/http/v1/active-tenant.controller'
import { MembershipsModule } from '../memberships/memberships.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'

@Module({
  imports: [MembershipsModule],
  controllers: [ActiveTenantController],
  providers: [SessionRepository, SessionService, AuthGuard, TenantGuard, RoleGuard],
  exports: [SessionService, SessionRepository],
})
export class SessionsModule {}
