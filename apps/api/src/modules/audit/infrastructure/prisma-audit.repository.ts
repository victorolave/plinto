import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { AuditEvent } from '../domain/audit-event.entity'
import { AuditRepository } from '../domain/audit.repository'

/**
 * Prisma adapter for the AuditRepository port. This is the only unit that
 * knows about Prisma for the audit aggregate; swapping ORMs means adding a
 * sibling adapter and rebinding the port in AuditModule.
 */
@Injectable()
export class PrismaAuditRepository extends AuditRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async create(data: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent> {
    const createData: Prisma.AuditEventCreateInput = {
      tenant: { connect: { id: data.tenantId } },
      actorUserId: data.actorUserId ?? null,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId ?? null,
      source: data.source,
      correlationId: data.correlationId,
      metadata: (data.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    }

    return this.prisma.auditEvent.create({ data: createData }) as Promise<AuditEvent>
  }
}
