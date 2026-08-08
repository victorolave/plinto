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

  /**
   * Unsets the active tenant on this user's live sessions, but only where it
   * points at the household given.
   *
   * Narrower than `updateActiveTenantForUser` on purpose: somebody removed from
   * one household may still belong to others, and clearing the tenant they were
   * actually looking at would eject them from a household they never left.
   */
  abstract clearActiveTenantForUser(
    userId: string,
    tenantId: string,
  ): Promise<{ count: number }>

  abstract revoke(sessionId: string): Promise<Session>

  abstract getActiveTenantByUserId(userId: string): Promise<string | null>
}
