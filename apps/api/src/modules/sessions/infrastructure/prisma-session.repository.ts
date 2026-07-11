import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Session } from '../domain/session.entity'
import { SessionRepository } from '../domain/session.repository'

/**
 * Prisma adapter for the SessionRepository port. This is the only unit that
 * knows about Prisma for the sessions aggregate; swapping ORMs means adding
 * a sibling adapter and rebinding the port in SessionsModule.
 */
@Injectable()
export class PrismaSessionRepository extends SessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async create(data: {
    userId: string
    tenantId?: string | null
    expiresAt: Date
    userAgent?: string | null
    ipAddress?: string | null
  }): Promise<Session> {
    return this.prisma.session.create({ data })
  }

  async findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id } })
  }

  async findActiveById(id: string): Promise<Session | null> {
    const now = new Date()
    return this.prisma.session.findFirst({
      where: { id, revokedAt: null, expiresAt: { gt: now } },
    })
  }

  /** Push a session's expiry forward (sliding expiration for active users). */
  async extendExpiry(sessionId: string, expiresAt: Date) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { expiresAt },
    })
  }

  async updateActiveTenant(sessionId: string, tenantId: string | null) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { tenantId },
    })
  }

  async updateActiveTenantForUser(userId: string, tenantId: string | null) {
    return this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { tenantId },
    })
  }

  async revoke(sessionId: string) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    })
  }

  async getActiveTenantByUserId(userId: string): Promise<string | null> {
    const now = new Date()
    const session = await this.prisma.session.findFirst({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    })
    return session?.tenantId ?? null
  }
}
