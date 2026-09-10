import { Module } from '@nestjs/common'
import { TenantRepository } from './domain/tenant.repository'
import { PrismaTenantRepository } from './infrastructure/prisma-tenant.repository'
import { TenantsController } from './interfaces/http/v1/tenants.controller'
import { OnboardingService } from './application/onboarding.service'
import { TenantService } from './application/tenant.service'
import { MembershipsModule } from '../memberships/memberships.module'
import { UsersModule } from '../users/users.module'
import { AuditModule } from '../audit/audit.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuthGuard } from '../../common/guards/auth.guard'

@Module({
  imports: [MembershipsModule, UsersModule, AuditModule, SessionsModule],
  controllers: [TenantsController],
  providers: [
    { provide: TenantRepository, useClass: PrismaTenantRepository },
    OnboardingService,
    TenantService,
    AuthGuard,
  ],
  exports: [TenantRepository, OnboardingService, TenantService],
})
export class TenantsModule {}
