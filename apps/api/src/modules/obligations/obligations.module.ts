import { Module } from '@nestjs/common'
import { RecurringModule } from '../recurring/recurring.module'
import { TransactionsModule } from '../transactions/transactions.module'
import { AuditModule } from '../audit/audit.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'
import { InternalKeyGuard } from '../../common/guards/internal-key.guard'
import { ObligationGenerationService } from './application/obligation-generation.service'
import { ObligationService } from './application/obligation.service'
import { ObligationRepository } from './domain/obligation.repository'
import { PrismaObligationRepository } from './infrastructure/prisma-obligation.repository'
import { ObligationGenerationController } from './interfaces/http/v1/obligation-generation.controller'
import { ObligationsController } from './interfaces/http/v1/obligations.controller'

@Module({
  // RecurringModule exports its repository port, which generation reads to find
  // the active rules a period must materialize; TransactionsModule exports the
  // transaction port that reconciliation validates against.
  imports: [
    RecurringModule,
    TransactionsModule,
    AuditModule,
    MembershipsModule,
    SessionsModule,
  ],
  controllers: [ObligationsController, ObligationGenerationController],
  providers: [
    ObligationService,
    ObligationGenerationService,
    { provide: ObligationRepository, useClass: PrismaObligationRepository },
    AuthGuard,
    TenantGuard,
    RoleGuard,
    InternalKeyGuard,
  ],
  exports: [ObligationService, ObligationGenerationService, ObligationRepository],
})
export class ObligationsModule {}
