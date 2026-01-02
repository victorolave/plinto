import { Module } from '@nestjs/common'
import { AuditRepository } from './infrastructure/audit.repository'
import { AuditService } from './application/audit.service'

@Module({
  providers: [AuditRepository, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
