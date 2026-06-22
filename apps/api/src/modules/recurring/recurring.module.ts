import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts/accounts.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'
import { RecurringTransactionService } from './application/recurring-transaction.service'
import { RecurringExecutionService } from './application/recurring-execution.service'
import { RecurringTransactionRepository } from './infrastructure/recurring-transaction.repository'
import { RecurringTransactionsController } from './interfaces/http/v1/recurring-transactions.controller'

@Module({
  imports: [AccountsModule, MembershipsModule, SessionsModule],
  controllers: [RecurringTransactionsController],
  providers: [
    RecurringTransactionService,
    RecurringExecutionService,
    RecurringTransactionRepository,
    AuthGuard,
    TenantGuard,
    RoleGuard,
  ],
  exports: [RecurringTransactionService, RecurringExecutionService, RecurringTransactionRepository],
})
export class RecurringModule {}
