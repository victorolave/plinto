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
})
