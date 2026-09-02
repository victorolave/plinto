import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { configuration } from './config/configuration'
import { validateEnv } from './config/env.validation'
import { DatabaseModule } from './infrastructure/database/database.module'
import { LoggerModule } from './infrastructure/logger/logger.module'
import { AuthModule as CommonAuthModule } from './common/auth/auth.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { TenantsModule } from './modules/tenants/tenants.module'
import { MembershipsModule } from './modules/memberships/memberships.module'
import { MembersModule } from './modules/memberships/members.module'
import { InvitationsModule } from './modules/invitations/invitations.module'
import { SessionsModule } from './modules/sessions/sessions.module'
import { AuditModule } from './modules/audit/audit.module'
import { AccountsModule } from './modules/accounts/accounts.module'
import { TransactionsModule } from './modules/transactions/transactions.module'
import { RecurringModule } from './modules/recurring/recurring.module'
import { ObligationsModule } from './modules/obligations/obligations.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { ReportsModule } from './modules/reports/reports.module'
import { DebtsModule } from './modules/debts/debts.module'
import { CreditModule } from './modules/credit/credit.module'
import { JobsModule } from './modules/jobs/jobs.module'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule,
    DatabaseModule,
    CommonAuthModule,
    // Feature modules - routes are prefixed with /api (set in main.ts)
    // For API versioning, we use /api/v1 in the controller paths or update
    // NEXT_PUBLIC_API_BASE_URL to point to /api instead of /api/v1
    AuthModule,
    UsersModule,
    TenantsModule,
    MembershipsModule,
    MembersModule,
    InvitationsModule,
    SessionsModule,
    AuditModule,
    AccountsModule,
    TransactionsModule,
    RecurringModule,
    ObligationsModule,
    CategoriesModule,
    ReportsModule,
    DebtsModule,
    CreditModule,
    JobsModule,
    HealthModule,
  ],
})
export class AppModule {}
