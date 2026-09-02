import { describe, expect, it } from 'vitest'
import { AuthorizationPolicy } from '../authorization-policy'

describe('AuthorizationPolicy', () => {
  describe('tenant selection', () => {
    it.each(['owner', 'member', 'viewer'] as const)(
      'allows %s to select an active tenant when membership is valid',
      (role) => {
        expect(AuthorizationPolicy.hasPermission(role, 'tenant:select')).toBe(true)
      },
    )

    it.each(['member', 'viewer'] as const)(
      'does not treat tenant selection as tenant management for %s',
      (role) => {
        expect(AuthorizationPolicy.hasPermission(role, 'tenant:manage')).toBe(false)
      },
    )
  })

  describe('members', () => {
    // A household is a shared context: everyone in it may see who else is in
    // it, including a viewer who cannot change a single number.
    it.each(['owner', 'member', 'viewer'] as const)(
      'allows %s to read the member list',
      (role) => {
        expect(AuthorizationPolicy.hasPermission(role, 'member:read')).toBe(true)
      },
    )

    // Reading the roster and changing it are different powers. Only the owner
    // administers membership; this is the boundary the members endpoints rely
    // on, so it is asserted rather than assumed.
    it.each(['member:invite', 'member:remove', 'member:change-role'] as const)(
      'restricts %s to the owner',
      (permission) => {
        expect(AuthorizationPolicy.hasPermission('owner', permission)).toBe(true)
        expect(AuthorizationPolicy.hasPermission('member', permission)).toBe(false)
        expect(AuthorizationPolicy.hasPermission('viewer', permission)).toBe(false)
      },
    )
  })

  describe('obligations', () => {
    it.each(['owner', 'member'] as const)(
      'allows %s to record and reconcile obligations',
      (role) => {
        expect(AuthorizationPolicy.hasPermission(role, 'obligation:write')).toBe(true)
      },
    )

    // A viewer sees what the household owes but cannot declare a bill settled.
    it('lets a viewer read obligations without writing them', () => {
      expect(AuthorizationPolicy.hasPermission('viewer', 'obligation:read')).toBe(true)
      expect(AuthorizationPolicy.hasPermission('viewer', 'obligation:write')).toBe(false)
    })

    it.each(['owner', 'member', 'viewer'] as const)(
      'allows %s to read obligations',
      (role) => {
        expect(AuthorizationPolicy.hasPermission(role, 'obligation:read')).toBe(true)
      },
    )
  })

  describe('revolving credit', () => {
    it.each(['owner', 'member'] as const)(
      'allows %s to record credit lines and their statements',
      (role) => {
        expect(AuthorizationPolicy.hasPermission(role, 'credit:write')).toBe(true)
      },
    )

    // Same line as obligations and debts: a viewer sees what the household
    // owes on a card, and cannot record a statement against it.
    it('lets a viewer read credit lines without writing them', () => {
      expect(AuthorizationPolicy.hasPermission('viewer', 'credit:read')).toBe(true)
      expect(AuthorizationPolicy.hasPermission('viewer', 'credit:write')).toBe(false)
    })

    it.each(['owner', 'member', 'viewer'] as const)(
      'allows %s to read credit lines',
      (role) => {
        expect(AuthorizationPolicy.hasPermission(role, 'credit:read')).toBe(true)
      },
    )
  })

  describe('household export', () => {
    // A full data dump — audit history and other members' emails included —
    // is owner-only, unlike every read permission above that a viewer also
    // holds.
    it('restricts tenant:export to the owner', () => {
      expect(AuthorizationPolicy.hasPermission('owner', 'tenant:export')).toBe(true)
      expect(AuthorizationPolicy.hasPermission('member', 'tenant:export')).toBe(false)
      expect(AuthorizationPolicy.hasPermission('viewer', 'tenant:export')).toBe(false)
    })
  })
})
