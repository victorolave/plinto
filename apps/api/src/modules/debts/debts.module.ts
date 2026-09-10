import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts/accounts.module'
import { AuditModule } from '../audit/audit.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { TransactionsModule } from '../transactions/transactions.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'
import { LoanService } from './application/loan.service'
import { DebtScheduleService } from './application/debt-schedule.service'
import { DebtScheduleRepository } from './domain/debt-schedule.repository'
import { PrismaDebtScheduleRepository } from './infrastructure/prisma-debt-schedule.repository'
import { LoansController } from './interfaces/http/v1/loans.controller'
import { DebtsController } from './interfaces/http/v1/debts.controller'

/**
 * What the household owes. Today that is loans received; PRD-007's later slices
 * add debt schedules and the household's total outstanding here.
 *
 * Depends on TransactionsModule rather than reimplementing a transfer: a loan
 * IS a movement between two accounts, and the ledger already knows how to make
 * one atomically.
 */
@Module({
  imports: [
    AccountsModule,
    TransactionsModule,
    AuditModule,
    MembershipsModule,
    SessionsModule,
  ],
  controllers: [LoansController, DebtsController],
  providers: [
    LoanService,
    DebtScheduleService,
    { provide: DebtScheduleRepository, useClass: PrismaDebtScheduleRepository },
    AuthGuard,
    TenantGuard,
    RoleGuard,
  ],
  exports: [LoanService, DebtScheduleService, DebtScheduleRepository],
})
export class DebtsModule {}
