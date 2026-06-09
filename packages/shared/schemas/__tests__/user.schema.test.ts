import { describe, it, expect } from 'vitest'
import { UserSchema } from '../user.schema'

describe('UserSchema', () => {
  const validUser = {
    id: 'user-1',
    email: 'alice@example.com',
    createdAt: '2024-01-01T00:00:00.000Z',
  }

  it('parses a valid user without name', () => {
    const result = UserSchema.safeParse(validUser)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBeUndefined()
    }
  })

  it('parses a valid user with name', () => {
    const result = UserSchema.safeParse({ ...validUser, name: 'Alice' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Alice')
    }
  })

  it('parses a valid user with null name', () => {
    const result = UserSchema.safeParse({ ...validUser, name: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBeNull()
    }
  })

  it('rejects invalid email', () => {
    const result = UserSchema.safeParse({ ...validUser, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects missing email', () => {
    const { email: _e, ...rest } = validUser
    const result = UserSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing id', () => {
    const { id: _id, ...rest } = validUser
    const result = UserSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing createdAt', () => {
    const { createdAt: _ca, ...rest } = validUser
    const result = UserSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })
})
