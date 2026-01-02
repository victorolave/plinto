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
import { SessionsModule } from './modules/sessions/sessions.module'
import { AuditModule } from './modules/audit/audit.module'

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
    SessionsModule,
    AuditModule,
  ],
})
export class AppModule {}
