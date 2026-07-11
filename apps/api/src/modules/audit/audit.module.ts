import { Module } from '@nestjs/common'
import { AuditRepository } from './domain/audit.repository'
import { PrismaAuditRepository } from './infrastructure/prisma-audit.repository'
import { AuditService } from './application/audit.service'

@Module({
  providers: [{ provide: AuditRepository, useClass: PrismaAuditRepository }, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
