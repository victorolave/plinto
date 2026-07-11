import { describe, expect, it } from 'vitest'
import { buildOpenApiDocument } from './openapi'

describe('buildOpenApiDocument', () => {
  it('generates an OpenAPI document with paths and component schemas', () => {
    const document = buildOpenApiDocument()

    expect(Object.keys(document.paths).length).toBeGreaterThan(0)
    expect(Object.keys(document.components?.schemas ?? {}).length).toBeGreaterThan(0)
  })
})
