import { Module } from '@nestjs/common'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'
import { ReportService } from './application/report.service'
import { ReportRepository } from './domain/report.repository'
import { PrismaReportRepository } from './infrastructure/prisma-report.repository'
import { ReportsController } from './interfaces/http/v1/reports.controller'

@Module({
  imports: [MembershipsModule, SessionsModule],
  controllers: [ReportsController],
  providers: [
    ReportService,
    { provide: ReportRepository, useClass: PrismaReportRepository },
    AuthGuard,
    TenantGuard,
    RoleGuard,
  ],
})
export class ReportsModule {}
