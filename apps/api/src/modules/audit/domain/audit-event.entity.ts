export type AuditSource = 'manual' | 'job' | 'import'

export type AuditEvent = {
  id: string
  tenantId: string
  actorUserId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  source: AuditSource
  correlationId: string
  createdAt: Date
  metadata?: unknown | null
}
