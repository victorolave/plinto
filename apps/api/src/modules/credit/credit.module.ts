import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'
import { CreditLineService } from './application/credit-line.service'
import { CreditLineStatementService } from './application/credit-line-statement.service'
import { CreditLineRepository } from './domain/credit-line.repository'
import { CreditLineStatementRepository } from './domain/credit-line-statement.repository'
import { PrismaCreditLineRepository } from './infrastructure/prisma-credit-line.repository'
import { PrismaCreditLineStatementRepository } from './infrastructure/prisma-credit-line-statement.repository'
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
    CreditLineStatementService,
    { provide: CreditLineRepository, useClass: PrismaCreditLineRepository },
    {
      provide: CreditLineStatementRepository,
      useClass: PrismaCreditLineStatementRepository,
    },
    AuthGuard,
    TenantGuard,
    RoleGuard,
  ],
  exports: [
    CreditLineService,
    CreditLineStatementService,
    CreditLineRepository,
    CreditLineStatementRepository,
  ],
})
export class CreditModule {}
