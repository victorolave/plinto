import { describe, expect, it, vi } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'
import { InternalKeyGuard } from '../internal-key.guard'

const makeContext = (headerValue: unknown) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { 'x-internal-key': headerValue } }),
    }),
  }) as any

const makeConfig = (expectedKey: string | undefined) => ({
  get: vi.fn().mockReturnValue(expectedKey),
})

describe('InternalKeyGuard', () => {
  it('allows the request when the provided key matches the configured key', () => {
    const guard = new InternalKeyGuard(makeConfig('secret') as any)

    expect(guard.canActivate(makeContext('secret'))).toBe(true)
  })

  it('accepts the first value when the header is provided as an array', () => {
    const guard = new InternalKeyGuard(makeConfig('secret') as any)

    expect(guard.canActivate(makeContext(['secret', 'other']))).toBe(true)
  })

  it('rejects a mismatched key', () => {
    const guard = new InternalKeyGuard(makeConfig('secret') as any)

    expect(() => guard.canActivate(makeContext('wrong'))).toThrow(UnauthorizedException)
  })

  it('rejects a missing key', () => {
    const guard = new InternalKeyGuard(makeConfig('secret') as any)

    expect(() => guard.canActivate(makeContext(undefined))).toThrow(UnauthorizedException)
  })

  it('rejects every request when no internal key is configured', () => {
    const guard = new InternalKeyGuard(makeConfig(undefined) as any)

    expect(() => guard.canActivate(makeContext('anything'))).toThrow(UnauthorizedException)
  })
})
