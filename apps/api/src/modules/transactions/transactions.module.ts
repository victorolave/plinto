import { Module } from '@nestjs/common'
import { TransactionService } from './application/transaction.service'
import { TransactionRepository } from './infrastructure/transaction.repository'
import { TransactionsController } from './interfaces/http/v1/transactions.controller'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AccountsModule } from '../accounts/accounts.module'
import { AuditModule } from '../audit/audit.module'
import { CategoriesModule } from '../categories/categories.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'

@Module({
  imports: [MembershipsModule, SessionsModule, AccountsModule, AuditModule, CategoriesModule],
  controllers: [TransactionsController],
  providers: [
    TransactionService,
    TransactionRepository,
    AuthGuard,
    TenantGuard,
    RoleGuard,
  ],
  exports: [TransactionService, TransactionRepository],
})
export class TransactionsModule {}
