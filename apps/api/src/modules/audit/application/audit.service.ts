import { Injectable } from '@nestjs/common'
import { AuditRepository } from '../infrastructure/audit.repository'
import { AuditSource } from '../domain/audit-event.entity'

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async record(event: {
    tenantId: string
    actorUserId?: string | null
    action: string
    resourceType: string
    resourceId?: string | null
    source?: AuditSource
    correlationId: string
    metadata?: unknown | null
  }) {
    return this.auditRepository.create({
      tenantId: event.tenantId,
      actorUserId: event.actorUserId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      source: event.source ?? 'manual',
      correlationId: event.correlationId,
      metadata: event.metadata ?? null,
    })
  }
}
