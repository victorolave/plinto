import { describe, it, expect } from 'vitest'
import { TenantSchema } from '../tenant.schema'

describe('TenantSchema', () => {
  const validTenant = {
    id: 'tenant-1',
    name: 'Acme Corp',
    baseCurrency: 'COP',
    createdAt: '2024-01-01T00:00:00.000Z',
  }

  it('parses a valid tenant', () => {
    const result = TenantSchema.safeParse(validTenant)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('tenant-1')
      expect(result.data.baseCurrency).toBe('COP')
    }
  })

  it('rejects missing id', () => {
    const { id: _id, ...rest } = validTenant
    const result = TenantSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const { name: _name, ...rest } = validTenant
    const result = TenantSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing baseCurrency', () => {
    const { baseCurrency: _bc, ...rest } = validTenant
    const result = TenantSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing createdAt', () => {
    const { createdAt: _ca, ...rest } = validTenant
    const result = TenantSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects non-string fields', () => {
    const result = TenantSchema.safeParse({ ...validTenant, id: 123 })
    expect(result.success).toBe(false)
  })
})
