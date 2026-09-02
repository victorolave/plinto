import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { TenantsModule } from '../tenants/tenants.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DemoHouseholdService } from './application/demo-household.service'
import { DemoHouseholdRepository } from './domain/demo-household.repository'
import { PrismaDemoHouseholdRepository } from './infrastructure/prisma-demo-household.repository'
import { DemoHouseholdController } from './interfaces/http/v1/demo-household.controller'

/**
 * The example household: create-on-demand, delete-in-one-action, never real
 * data. See `demo-household-dataset.ts` for the dataset itself.
 */
@Module({
  imports: [AuditModule, MembershipsModule, SessionsModule, TenantsModule],
  controllers: [DemoHouseholdController],
  providers: [
    DemoHouseholdService,
    { provide: DemoHouseholdRepository, useClass: PrismaDemoHouseholdRepository },
    AuthGuard,
  ],
  exports: [DemoHouseholdService],
})
export class DemoModule {}
