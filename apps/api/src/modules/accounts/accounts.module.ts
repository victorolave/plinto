import { Module } from '@nestjs/common'
import { AccountService } from './application/account.service'
import { AccountRepository } from './infrastructure/account.repository'
import { AccountsController } from './interfaces/http/v1/accounts.controller'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuditModule } from '../audit/audit.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'

@Module({
  imports: [MembershipsModule, SessionsModule, AuditModule],
  controllers: [AccountsController],
  providers: [
    AccountService,
    AccountRepository,
    AuthGuard,
    TenantGuard,
    RoleGuard,
  ],
  exports: [AccountService, AccountRepository],
})
export class AccountsModule {}
