export type Session = {
  id: string
  userId: string
  tenantId?: string | null
  createdAt: Date
  expiresAt: Date
  revokedAt?: Date | null
  lastSeenAt?: Date | null
  userAgent?: string | null
  ipAddress?: string | null
}
