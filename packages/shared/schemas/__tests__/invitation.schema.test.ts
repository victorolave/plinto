import { describe, it, expect } from 'vitest'
import {
  CreateInvitationSchema,
  InvitationResultSchema,
  InvitationSchema,
} from '../invitation.schema'

describe('CreateInvitationSchema', () => {
  /**
   * Normalising in the contract rather than in a handler is what makes "one
   * pending invitation per person" true. The database enforces uniqueness over
   * (tenant, email), and it cannot tell that `Sandra@Example.com` and
   * `sandra@example.com` are one person.
   */
  it('trims and lower-cases the address', () => {
    const result = CreateInvitationSchema.safeParse({
      email: '  Sandra@Example.COM  ',
      role: 'member',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('sandra@example.com')
    }
  })

  it('validates the address after normalising, not before', () => {
    // Would fail `.email()` with the surrounding spaces if the order were
    // reversed, which is the bug this ordering exists to avoid.
    expect(CreateInvitationSchema.safeParse({ email: '  a@b.co  ', role: 'viewer' }).success).toBe(
      true,
    )
  })

  it.each(['not-an-email', '', 'sandra@', '@example.com', 'sandra example.com'])(
    'rejects %p',
    (email) => {
      expect(CreateInvitationSchema.safeParse({ email, role: 'member' }).success).toBe(false)
    },
  )

  it.each(['owner', 'member', 'viewer'])('accepts the %s role', (role) => {
    expect(
      CreateInvitationSchema.safeParse({ email: 'a@b.co', role }).success,
    ).toBe(true)
  })

  it('rejects a role outside the permission matrix', () => {
    expect(CreateInvitationSchema.safeParse({ email: 'a@b.co', role: 'admin' }).success).toBe(
      false,
    )
  })

  it('requires a role rather than defaulting to one', () => {
    // A silent default would decide someone's authority over a household's
    // money on their behalf.
    expect(CreateInvitationSchema.safeParse({ email: 'a@b.co' }).success).toBe(false)
  })
})

describe('InvitationSchema', () => {
  const valid = {
    id: 'inv-1',
    tenantId: 'tenant-1',
    email: 'sandra@example.com',
    role: 'member' as const,
    invitedByUserId: 'user-1',
    expiresAt: '2026-08-22T00:00:00.000Z',
    createdAt: '2026-08-08T00:00:00.000Z',
  }

  it('parses a complete invitation', () => {
    expect(InvitationSchema.safeParse(valid).success).toBe(true)
  })

  it.each(['id', 'tenantId', 'email', 'role', 'invitedByUserId', 'expiresAt'])(
    'rejects a missing %s',
    (field) => {
      const { [field]: _dropped, ...rest } = valid as Record<string, unknown>
      expect(InvitationSchema.safeParse(rest).success).toBe(false)
    },
  )
})

describe('InvitationResultSchema', () => {
  const member = {
    userId: 'user-2',
    email: 'sandra@example.com',
    name: 'Sandra',
    role: 'member' as const,
    joinedAt: '2026-08-08T00:00:00.000Z',
  }
  const invitation = {
    id: 'inv-1',
    tenantId: 'tenant-1',
    email: 'sandra@example.com',
    role: 'member' as const,
    invitedByUserId: 'user-1',
    expiresAt: '2026-08-22T00:00:00.000Z',
    createdAt: '2026-08-08T00:00:00.000Z',
  }

  it('carries the member when the invitee already had an account', () => {
    const result = InvitationResultSchema.safeParse({
      status: 'accepted',
      invitation: null,
      member,
    })

    expect(result.success).toBe(true)
  })

  it('carries the invitation when it is waiting for a first login', () => {
    const result = InvitationResultSchema.safeParse({
      status: 'pending',
      invitation,
      member: null,
    })

    expect(result.success).toBe(true)
  })

  // Both sides are nullable rather than optional: the field is always present,
  // so a client reading it can tell "no member" from "the producer forgot".
  it('requires both fields to be present, even when null', () => {
    expect(InvitationResultSchema.safeParse({ status: 'pending' }).success).toBe(false)
  })

  it('rejects a status outside the two the API returns', () => {
    expect(
      InvitationResultSchema.safeParse({ status: 'expired', invitation: null, member: null })
        .success,
    ).toBe(false)
  })
})
