import { Session } from './session.entity'

/**
 * Port: the session persistence contract the application layer depends on.
 * Adapters (e.g. PrismaSessionRepository) live in the infrastructure layer
 * and implement this abstract class, which doubles as the DI token — so the
 * ORM can be swapped by binding a different adapter without touching
 * business logic.
 */
export abstract class SessionRepository {
  abstract create(data: {
    userId: string
    tenantId?: string | null
    expiresAt: Date
    userAgent?: string | null
    ipAddress?: string | null
  }): Promise<Session>

  abstract findById(id: string): Promise<Session | null>

  abstract findActiveById(id: string): Promise<Session | null>

  /** Push a session's expiry forward (sliding expiration for active users). */
  abstract extendExpiry(sessionId: string, expiresAt: Date): Promise<Session>

  abstract updateActiveTenant(sessionId: string, tenantId: string | null): Promise<Session>

  abstract updateActiveTenantForUser(
    userId: string,
    tenantId: string | null,
  ): Promise<{ count: number }>

  abstract revoke(sessionId: string): Promise<Session>

  abstract getActiveTenantByUserId(userId: string): Promise<string | null>
}
