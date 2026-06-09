import { describe, it, expect } from 'vitest'
import { SessionSchema } from '../session.schema'

describe('SessionSchema', () => {
  const validSession = {
    id: 'session-1',
    userId: 'user-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    expiresAt: '2024-01-01T00:30:00.000Z',
  }

  it('parses a valid session without tenantId', () => {
    const result = SessionSchema.safeParse(validSession)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tenantId).toBeUndefined()
    }
  })

  it('parses a valid session with tenantId', () => {
    const result = SessionSchema.safeParse({ ...validSession, tenantId: 'tenant-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tenantId).toBe('tenant-1')
    }
  })

  it('parses a valid session with null tenantId', () => {
    const result = SessionSchema.safeParse({ ...validSession, tenantId: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tenantId).toBeNull()
    }
  })

  it('rejects missing id', () => {
    const { id: _id, ...rest } = validSession
    const result = SessionSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing userId', () => {
    const { userId: _uid, ...rest } = validSession
    const result = SessionSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing expiresAt', () => {
    const { expiresAt: _ea, ...rest } = validSession
    const result = SessionSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing createdAt', () => {
    const { createdAt: _ca, ...rest } = validSession
    const result = SessionSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })
})
