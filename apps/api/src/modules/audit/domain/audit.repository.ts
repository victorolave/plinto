import { AuditEvent } from './audit-event.entity'

/**
 * Port: the audit event persistence contract the application layer depends
 * on. Adapters (e.g. PrismaAuditRepository) live in the infrastructure layer
 * and implement this abstract class, which doubles as the DI token — so the
 * ORM can be swapped by binding a different adapter without touching
 * business logic.
 */
export abstract class AuditRepository {
  abstract create(data: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent>
}
