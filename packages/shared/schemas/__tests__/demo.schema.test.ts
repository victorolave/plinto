import { describe, expect, it } from 'vitest'
import { CreateDemoHouseholdSchema } from '../demo.schema'

describe('CreateDemoHouseholdSchema', () => {
  it('accepts an empty body', () => {
    const result = CreateDemoHouseholdSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts locale "es"', () => {
    const result = CreateDemoHouseholdSchema.safeParse({ locale: 'es' })
    expect(result.success).toBe(true)
  })

  it('accepts locale "en"', () => {
    const result = CreateDemoHouseholdSchema.safeParse({ locale: 'en' })
    expect(result.success).toBe(true)
  })

  it('rejects an unsupported locale', () => {
    const result = CreateDemoHouseholdSchema.safeParse({ locale: 'fr' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-string locale', () => {
    const result = CreateDemoHouseholdSchema.safeParse({ locale: 1 })
    expect(result.success).toBe(false)
  })
})
