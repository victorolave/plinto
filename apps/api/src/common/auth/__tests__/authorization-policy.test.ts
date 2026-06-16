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
})
