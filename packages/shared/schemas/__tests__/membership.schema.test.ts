import { describe, it, expect } from 'vitest'
import {
  MembershipRoleSchema,
  MembershipSchema,
  TenantMemberSchema,
} from '../membership.schema'

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

describe('MembershipRoleSchema', () => {
  it.each(['owner', 'member', 'viewer'])('accepts the %s role', (role) => {
    expect(MembershipRoleSchema.safeParse(role).success).toBe(true)
  })

  // The API's permission matrix is keyed by exactly these three literals, so a
  // fourth role reaching a client would have no permissions at all.
  it.each(['admin', 'guest', 'OWNER', ''])('rejects %s', (role) => {
    expect(MembershipRoleSchema.safeParse(role).success).toBe(false)
  })
})

describe('TenantMemberSchema', () => {
  const validMember = {
    userId: 'user-1',
    email: 'victor@example.com',
    name: 'Victor',
    role: 'owner' as const,
    joinedAt: '2026-01-01T00:00:00.000Z',
  }

  it('parses a valid member', () => {
    expect(TenantMemberSchema.safeParse(validMember).success).toBe(true)
  })

  // The identity provider is not required to return a display name, so the
  // member list has to survive its absence.
  it('accepts a null name', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, name: null })
    expect(result.success).toBe(true)
  })

  it('rejects an undefined name, which would hide a mapping bug', () => {
    const { name: _n, ...rest } = validMember
    expect(TenantMemberSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a malformed email', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid role', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, role: 'admin' })
    expect(result.success).toBe(false)
  })

  // The membership row id is an internal join key. Zod strips unknown keys, so
  // this pins that it never survives into the member contract.
  it('strips the membership id if a producer leaks it', () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, id: 'membership-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('id')
    }
  })
})
