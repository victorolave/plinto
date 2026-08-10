import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'
import { CreditLineService } from './application/credit-line.service'
import { CreditLineRepository } from './domain/credit-line.repository'
import { PrismaCreditLineRepository } from './infrastructure/prisma-credit-line.repository'
import { CreditLinesController } from './interfaces/http/v1/credit-lines.controller'

/**
 * Revolving credit: cards and rotating lines, and the statements they issue.
 * See PRD-011.
 *
 * Deliberately independent of AccountsModule. A credit line is not an account,
 * and the whole point of the model is that its balance comes from a declared
 * statement rather than from movements on a ledger.
 */
@Module({
  imports: [AuditModule, MembershipsModule, SessionsModule],
  controllers: [CreditLinesController],
  providers: [
    CreditLineService,
    { provide: CreditLineRepository, useClass: PrismaCreditLineRepository },
    AuthGuard,
    TenantGuard,
    RoleGuard,
  ],
  exports: [CreditLineService, CreditLineRepository],
})
export class CreditModule {}
