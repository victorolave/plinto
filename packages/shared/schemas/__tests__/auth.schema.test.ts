import { describe, it, expect } from 'vitest'
import {
  UpdateProfileSchema,
  CreateTenantSchema,
  SelectTenantSchema,
  CreateSessionSchema,
} from '../auth.schema'

describe('UpdateProfileSchema', () => {
  it('parses a valid name', () => {
    const result = UpdateProfileSchema.safeParse({ name: 'Alice' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Alice')
    }
  })

  it('rejects empty name', () => {
    const result = UpdateProfileSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = UpdateProfileSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects non-string name', () => {
    const result = UpdateProfileSchema.safeParse({ name: 42 })
    expect(result.success).toBe(false)
  })
})

describe('CreateTenantSchema', () => {
  it('parses a valid tenant with name only', () => {
    const result = CreateTenantSchema.safeParse({ name: 'Acme Corp' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Acme Corp')
      expect(result.data.baseCurrency).toBeUndefined()
    }
  })

  it('parses a valid tenant with name and baseCurrency', () => {
    const result = CreateTenantSchema.safeParse({ name: 'Acme Corp', baseCurrency: 'USD' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.baseCurrency).toBe('USD')
    }
  })

  it('trims whitespace from baseCurrency', () => {
    const result = CreateTenantSchema.safeParse({ name: 'Acme', baseCurrency: '  USD  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.baseCurrency).toBe('USD')
    }
  })

  it('rejects empty name', () => {
    const result = CreateTenantSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = CreateTenantSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects empty baseCurrency after trimming', () => {
    const result = CreateTenantSchema.safeParse({ name: 'Acme', baseCurrency: '   ' })
    expect(result.success).toBe(false)
  })
})

describe('SelectTenantSchema', () => {
  it('parses a valid tenantId', () => {
    const result = SelectTenantSchema.safeParse({ tenantId: 'tenant-abc' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tenantId).toBe('tenant-abc')
    }
  })

  it('rejects empty tenantId', () => {
    const result = SelectTenantSchema.safeParse({ tenantId: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing tenantId', () => {
    const result = SelectTenantSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('CreateSessionSchema', () => {
  it('parses valid minimal payload (idpSub + email)', () => {
    const result = CreateSessionSchema.safeParse({
      idpSub: 'google|12345',
      email: 'user@example.com',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.idpSub).toBe('google|12345')
      expect(result.data.email).toBe('user@example.com')
      expect(result.data.name).toBeUndefined()
    }
  })

  it('parses valid payload with optional name', () => {
    const result = CreateSessionSchema.safeParse({
      idpSub: 'google|12345',
      email: 'user@example.com',
      name: 'Alice',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Alice')
    }
  })

  it('parses valid payload with null name', () => {
    const result = CreateSessionSchema.safeParse({
      idpSub: 'google|12345',
      email: 'user@example.com',
      name: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBeNull()
    }
  })

  it('rejects missing idpSub', () => {
    const result = CreateSessionSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(false)
  })

  it('rejects empty idpSub', () => {
    const result = CreateSessionSchema.safeParse({ idpSub: '', email: 'user@example.com' })
    expect(result.success).toBe(false)
  })

  it('rejects missing email', () => {
    const result = CreateSessionSchema.safeParse({ idpSub: 'google|12345' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email format', () => {
    const result = CreateSessionSchema.safeParse({ idpSub: 'google|12345', email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects empty name string (min 1 when provided)', () => {
    const result = CreateSessionSchema.safeParse({
      idpSub: 'google|12345',
      email: 'user@example.com',
      name: '',
    })
    expect(result.success).toBe(false)
  })
})
