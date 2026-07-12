import { describe, expect, it } from 'vitest'
import { buildOpenApiDocument } from './openapi'

// Path + method pairs that MUST be present in the generated document. Sourced
// from the actual controllers (not guessed) so route drift — a controller
// method added/renamed without a matching openapi.ts registration — fails
// this test instead of silently shipping an incomplete spec.
const EXPECTED_PATHS: Array<{ path: string; method: string }> = [
  // Accounts (AccountsController)
  { path: '/api/accounts', method: 'get' },
  { path: '/api/accounts', method: 'post' },
  { path: '/api/accounts/{id}', method: 'patch' },
  { path: '/api/accounts/{id}/restore', method: 'post' },
  { path: '/api/accounts/{id}', method: 'delete' },
  // Transactions (TransactionsController)
  { path: '/api/transactions', method: 'get' },
  { path: '/api/transactions/balances', method: 'get' },
  { path: '/api/transactions', method: 'post' },
  { path: '/api/transactions/transfers', method: 'post' },
  { path: '/api/transactions/{id}', method: 'patch' },
  // Tenants (TenantsController, ActiveTenantController)
  { path: '/api/tenants', method: 'get' },
  { path: '/api/tenants', method: 'post' },
  { path: '/api/tenants/active', method: 'get' },
  { path: '/api/tenants/active', method: 'post' },
  // Auth / Users (UsersController, SessionsController)
  { path: '/api/me', method: 'get' },
  { path: '/api/me', method: 'patch' },
  { path: '/api/auth/session', method: 'post' },
  { path: '/api/auth/logout', method: 'post' },
]

describe('buildOpenApiDocument', () => {
  it('generates an OpenAPI document with paths and component schemas', () => {
    const document = buildOpenApiDocument()

    expect(Object.keys(document.paths).length).toBeGreaterThan(0)
    expect(Object.keys(document.components?.schemas ?? {}).length).toBeGreaterThan(0)
  })

  it.each(EXPECTED_PATHS)(
    'registers $method $path',
    ({ path, method }) => {
      const document = buildOpenApiDocument()
      const pathItem = document.paths[path]

      expect(pathItem, `expected path "${path}" to be registered`).toBeDefined()
      expect(
        pathItem?.[method as keyof typeof pathItem],
        `expected method "${method.toUpperCase()} ${path}" to be registered`,
      ).toBeDefined()
    },
  )
})
