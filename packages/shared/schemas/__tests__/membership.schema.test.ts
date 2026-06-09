import { describe, it, expect } from 'vitest'
import { MembershipSchema } from '../membership.schema'

describe('MembershipSchema', () => {
  const validMembership = {
    id: 'mem-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    role: 'owner' as const,
    createdAt: '2024-01-01T00:00:00.000Z',
  }

  it('parses a valid membership with role owner', () => {
    const result = MembershipSchema.safeParse(validMembership)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.role).toBe('owner')
    }
  })

  it('parses role member', () => {
    const result = MembershipSchema.safeParse({ ...validMembership, role: 'member' })
    expect(result.success).toBe(true)
  })

  it('parses role viewer', () => {
    const result = MembershipSchema.safeParse({ ...validMembership, role: 'viewer' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid role', () => {
    const result = MembershipSchema.safeParse({ ...validMembership, role: 'admin' })
    expect(result.success).toBe(false)
  })

  it('rejects missing tenantId', () => {
    const { tenantId: _ti, ...rest } = validMembership
    const result = MembershipSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing userId', () => {
    const { userId: _ui, ...rest } = validMembership
    const result = MembershipSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing role', () => {
    const { role: _r, ...rest } = validMembership
    const result = MembershipSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })
})
