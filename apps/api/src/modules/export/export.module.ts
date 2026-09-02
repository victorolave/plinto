import { Module } from '@nestjs/common'
import { HouseholdExportService } from './application/household-export.service'
import { HouseholdExportRepository } from './domain/household-export.entity'
import { PrismaHouseholdExportRepository } from './infrastructure/prisma-household-export.repository'
import { ExportController } from './interfaces/http/v1/export.controller'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuditModule } from '../audit/audit.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'

@Module({
  imports: [MembershipsModule, SessionsModule, AuditModule],
  controllers: [ExportController],
  providers: [
    HouseholdExportService,
    { provide: HouseholdExportRepository, useClass: PrismaHouseholdExportRepository },
    AuthGuard,
    TenantGuard,
    RoleGuard,
  ],
})
export class ExportModule {}
