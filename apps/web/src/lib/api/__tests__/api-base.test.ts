import { describe, expect, it, beforeEach, vi } from 'vitest'
import { resolveApiBase } from '../api-base'

describe('resolveApiBase', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers API_INTERNAL_URL over NEXT_PUBLIC_API_BASE_URL when both are set', () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:3001/api')
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.com/api')

    expect(resolveApiBase()).toBe('http://api.internal:3001/api')
  })

  it('falls back to NEXT_PUBLIC_API_BASE_URL when API_INTERNAL_URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.com/api')

    expect(resolveApiBase()).toBe('https://api.example.com/api')
  })

  it('falls back to the localhost:3001 default when neither is set', () => {
    expect(resolveApiBase()).toBe('http://localhost:3001/api')
  })

  it('anchors a relative API_INTERNAL_URL to http://localhost:3001', () => {
    vi.stubEnv('API_INTERNAL_URL', '/api/v1')

    expect(resolveApiBase()).toBe('http://localhost:3001/api/v1')
  })

  it('anchors a relative NEXT_PUBLIC_API_BASE_URL to http://localhost:3001', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api/v1')

    expect(resolveApiBase()).toBe('http://localhost:3001/api/v1')
  })

  it('treats an empty-string override as unset', () => {
    vi.stubEnv('API_INTERNAL_URL', '')
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')

    expect(resolveApiBase()).toBe('http://localhost:3001/api')
  })

  describe('requestUrl option', () => {
    it('anchors a relative configured base to the request origin when requestUrl is given', () => {
      vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api')

      expect(
        resolveApiBase({ requestUrl: 'https://plinto.example.com/callback?code=abc' }),
      ).toBe('https://plinto.example.com/api')
    })

    it('anchors a relative API_INTERNAL_URL to the request origin too, taking precedence', () => {
      vi.stubEnv('API_INTERNAL_URL', '/internal-api')
      vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://public.example.com/api')

      expect(
        resolveApiBase({ requestUrl: 'https://plinto.example.com/callback' }),
      ).toBe('https://plinto.example.com/internal-api')
    })

    it('falls back to http://localhost:3001 for a relative base with no requestUrl', () => {
      vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api')

      expect(resolveApiBase()).toBe('http://localhost:3001/api')
    })

    it('ignores requestUrl when the configured base is already absolute', () => {
      vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.com/api')

      expect(
        resolveApiBase({ requestUrl: 'https://plinto.example.com/callback' }),
      ).toBe('https://api.example.com/api')
    })
  })
})
