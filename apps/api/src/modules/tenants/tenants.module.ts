import { Module } from '@nestjs/common'
import { TenantRepository } from './infrastructure/tenant.repository'
import { TenantsController } from './interfaces/http/v1/tenants.controller'
import { OnboardingService } from './application/onboarding.service'
import { MembershipsModule } from '../memberships/memberships.module'
import { UsersModule } from '../users/users.module'
import { AuditModule } from '../audit/audit.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuthGuard } from '../../common/guards/auth.guard'

@Module({
  imports: [MembershipsModule, UsersModule, AuditModule, SessionsModule],
  controllers: [TenantsController],
  providers: [TenantRepository, OnboardingService, AuthGuard],
  exports: [TenantRepository, OnboardingService],
})
export class TenantsModule {}
