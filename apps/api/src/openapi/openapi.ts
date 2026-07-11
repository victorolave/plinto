import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi'
import type { OpenAPIObject } from '@nestjs/swagger'
import { z } from 'zod'
import {
  AccountSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
  TransactionSchema,
  CreateTransactionSchema,
  UpdateTransactionSchema,
  CreateTransferSchema,
  TransferSchema,
  AccountBalanceSchema,
  CategorySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  ExpenseByCategoryReportSchema,
  RecurringTransactionRuleSchema,
  CreateRecurringTransactionRuleSchema,
  CreateSessionSchema,
  UserSchema,
  MembershipSchema,
  ErrorResponseSchema,
} from '@plinto/shared'

// Registers the `.openapi()` helper on the Zod prototype. Must run exactly
// once, at module load, before any schema is registered below.
extendZodWithOpenApi(z)

const registry = new OpenAPIRegistry()

// ---------------------------------------------------------------------------
// Security schemes
// ---------------------------------------------------------------------------

registry.registerComponent('securitySchemes', 'sessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: 'plinto_session',
  description:
    'Session JWT issued by POST /api/auth/session and set as an httpOnly cookie. ' +
    'Required by every tenant-scoped endpoint (Accounts, Transactions, Categories, ' +
    'Recurring, Reports) as well as POST /api/auth/logout.',
})

registry.registerComponent('securitySchemes', 'internalApiKey', {
  type: 'apiKey',
  in: 'header',
  name: 'x-internal-key',
  description:
    'Shared secret used for trusted, service-to-service calls that bypass the ' +
    'user session (see InternalKeyGuard). Required by POST /api/auth/session ' +
    '(session issuance from the trusted identity layer) and by ' +
    'POST /api/internal/recurring/execute (invoked by the recurring-execution ' +
    'scheduler/worker per ADR 0006).',
})

// ---------------------------------------------------------------------------
// Component schemas (registered under components/schemas)
// ---------------------------------------------------------------------------

const AccountSchemaRef = registry.register('Account', AccountSchema)
const CreateAccountSchemaRef = registry.register('CreateAccount', CreateAccountSchema)
const UpdateAccountSchemaRef = registry.register('UpdateAccount', UpdateAccountSchema)

const TransactionSchemaRef = registry.register('Transaction', TransactionSchema)
const CreateTransactionSchemaRef = registry.register(
  'CreateTransaction',
  CreateTransactionSchema,
)
const UpdateTransactionSchemaRef = registry.register(
  'UpdateTransaction',
  UpdateTransactionSchema,
)
const CreateTransferSchemaRef = registry.register('CreateTransfer', CreateTransferSchema)
const TransferSchemaRef = registry.register('Transfer', TransferSchema)
const AccountBalanceSchemaRef = registry.register('AccountBalance', AccountBalanceSchema)

const CategorySchemaRef = registry.register('Category', CategorySchema)
const CreateCategorySchemaRef = registry.register('CreateCategory', CreateCategorySchema)
const UpdateCategorySchemaRef = registry.register('UpdateCategory', UpdateCategorySchema)

const ExpenseByCategoryReportSchemaRef = registry.register(
  'ExpenseByCategoryReport',
  ExpenseByCategoryReportSchema,
)

const RecurringTransactionRuleSchemaRef = registry.register(
  'RecurringTransactionRule',
  RecurringTransactionRuleSchema,
)
const CreateRecurringTransactionRuleSchemaRef = registry.register(
  'CreateRecurringTransactionRule',
  CreateRecurringTransactionRuleSchema,
)

const CreateSessionSchemaRef = registry.register('CreateSession', CreateSessionSchema)
const UserSchemaRef = registry.register('User', UserSchema)
const MembershipSchemaRef = registry.register('Membership', MembershipSchema)

const ErrorResponseSchemaRef = registry.register('ErrorResponse', ErrorResponseSchema)

// Registry-only composite schemas: these compose existing shared schemas for
// documentation purposes without touching packages/shared. Attaching
// `.openapi(name)` only records metadata on the extended Zod instance created
// above — it does not mutate the shared package.
const TransferResultSchema = z
  .object({
    transfer: TransferSchemaRef,
    debit: TransactionSchemaRef,
    credit: TransactionSchemaRef,
  })
  .openapi('TransferResult')

const ExecuteRecurringRequestSchema = z
  .object({
    dueDate: z.string().datetime().optional(),
    jobId: z.string().min(1).optional(),
  })
  .openapi('ExecuteRecurringRequest')

const ExecuteRecurringResultSchema = z
  .object({
    created: z.number().int(),
    skipped: z.number().int(),
  })
  .openapi('ExecuteRecurringResult')

const CreateSessionResultSchema = z
  .object({
    sessionId: z.string(),
    expiresAt: z.string(),
    user: UserSchemaRef,
    memberships: z.array(MembershipSchemaRef),
    activeTenantId: z.string().nullable(),
    needsOnboarding: z.boolean(),
  })
  .openapi('CreateSessionResult')

const DeletedResultSchema = z
  .object({ deleted: z.boolean() })
  .openapi('DeletedResult')

const LogoutResultSchema = z
  .object({ success: z.boolean() })
  .openapi('LogoutResult')

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

const dataResponse = (description: string, schema: z.ZodTypeAny) => ({
  description,
  content: { 'application/json': { schema: z.object({ data: schema }) } },
})

const errorResponses = {
  400: {
    description: 'Validation error or malformed request.',
    content: { 'application/json': { schema: ErrorResponseSchemaRef } },
  },
  401: {
    description: 'Missing or invalid authentication.',
    content: { 'application/json': { schema: ErrorResponseSchemaRef } },
  },
  403: {
    description: 'Authenticated but not authorized for this action.',
    content: { 'application/json': { schema: ErrorResponseSchemaRef } },
  },
  404: {
    description: 'Resource not found.',
    content: { 'application/json': { schema: ErrorResponseSchemaRef } },
  },
} as const

const sessionCookieAuth = [{ sessionCookie: [] }]
const internalKeyAuth = [{ internalApiKey: [] }]

const idParam = z.object({ id: z.string().min(1) })

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/accounts',
  tags: ['Accounts'],
  summary: 'List accounts for the active tenant',
  security: sessionCookieAuth,
  request: {
    query: z.object({
      includeArchived: z.enum(['true', 'false']).optional(),
    }),
  },
  responses: {
    200: dataResponse(
      'Accounts for the active tenant.',
      z.object({ accounts: z.array(AccountSchemaRef) }),
    ),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/accounts',
  tags: ['Accounts'],
  summary: 'Create an account',
  security: sessionCookieAuth,
  request: {
    body: { content: { 'application/json': { schema: CreateAccountSchemaRef } } },
  },
  responses: {
    201: dataResponse('Account created.', z.object({ account: AccountSchemaRef })),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/accounts/{id}',
  tags: ['Accounts'],
  summary: 'Update an account',
  security: sessionCookieAuth,
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: UpdateAccountSchemaRef } } },
  },
  responses: {
    200: dataResponse('Account updated.', z.object({ account: AccountSchemaRef })),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/accounts/{id}/restore',
  tags: ['Accounts'],
  summary: 'Restore an archived account',
  security: sessionCookieAuth,
  request: { params: idParam },
  responses: {
    200: dataResponse('Account restored.', z.object({ account: AccountSchemaRef })),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/accounts/{id}',
  tags: ['Accounts'],
  summary: 'Archive an account',
  security: sessionCookieAuth,
  request: { params: idParam },
  responses: {
    200: dataResponse('Account archived.', z.object({ account: AccountSchemaRef })),
    ...errorResponses,
  },
})

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/transactions',
  tags: ['Transactions'],
  summary: 'List transactions for the active tenant (paginated)',
  security: sessionCookieAuth,
  request: {
    query: z.object({
      accountId: z.string().optional(),
      page: z.string().optional(),
      pageSize: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of transactions.',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({ transactions: z.array(TransactionSchemaRef) }),
            meta: z.object({
              pagination: z.object({
                page: z.number().int(),
                pageSize: z.number().int(),
                total: z.number().int(),
                totalPages: z.number().int(),
              }),
            }),
          }),
        },
      },
    },
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/transactions/balances',
  tags: ['Transactions'],
  summary: 'Get per-account balances for the active tenant',
  security: sessionCookieAuth,
  responses: {
    200: dataResponse(
      'Balances grouped by account.',
      z.object({ balances: z.array(AccountBalanceSchemaRef) }),
    ),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/transactions',
  tags: ['Transactions'],
  summary: 'Create a transaction (income or expense)',
  security: sessionCookieAuth,
  request: {
    body: { content: { 'application/json': { schema: CreateTransactionSchemaRef } } },
  },
  responses: {
    201: dataResponse(
      'Transaction created.',
      z.object({ transaction: TransactionSchemaRef }),
    ),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/transactions/transfers',
  tags: ['Transactions'],
  summary: 'Transfer funds between two accounts',
  security: sessionCookieAuth,
  request: {
    body: { content: { 'application/json': { schema: CreateTransferSchemaRef } } },
  },
  responses: {
    201: dataResponse('Transfer created.', TransferResultSchema),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/transactions/{id}',
  tags: ['Transactions'],
  summary: 'Update a transaction',
  security: sessionCookieAuth,
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: UpdateTransactionSchemaRef } } },
  },
  responses: {
    200: dataResponse(
      'Transaction updated.',
      z.object({ transaction: TransactionSchemaRef }),
    ),
    ...errorResponses,
  },
})

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/categories',
  tags: ['Categories'],
  summary: 'List categories for the active tenant',
  security: sessionCookieAuth,
  responses: {
    200: dataResponse(
      'Categories for the active tenant.',
      z.object({ categories: z.array(CategorySchemaRef) }),
    ),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/categories/{id}',
  tags: ['Categories'],
  summary: 'Get a category by id',
  security: sessionCookieAuth,
  request: { params: idParam },
  responses: {
    200: dataResponse('Category found.', z.object({ category: CategorySchemaRef })),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/categories',
  tags: ['Categories'],
  summary: 'Create a category',
  security: sessionCookieAuth,
  request: {
    body: { content: { 'application/json': { schema: CreateCategorySchemaRef } } },
  },
  responses: {
    201: dataResponse('Category created.', z.object({ category: CategorySchemaRef })),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/categories/{id}',
  tags: ['Categories'],
  summary: 'Update a category',
  security: sessionCookieAuth,
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: UpdateCategorySchemaRef } } },
  },
  responses: {
    200: dataResponse('Category updated.', z.object({ category: CategorySchemaRef })),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/categories/{id}',
  tags: ['Categories'],
  summary: 'Delete a category',
  security: sessionCookieAuth,
  request: { params: idParam },
  responses: {
    200: dataResponse('Category deleted.', DeletedResultSchema),
    ...errorResponses,
  },
})

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/reports/expenses-by-category',
  tags: ['Reports'],
  summary: 'Get total expenses grouped by category for a date range',
  security: sessionCookieAuth,
  request: {
    query: z.object({
      from: z.string().describe('Start date (YYYY-MM-DD), inclusive, UTC.'),
      to: z.string().describe('End date (YYYY-MM-DD), inclusive, UTC.'),
    }),
  },
  responses: {
    200: {
      description: 'Expenses grouped by category for the requested period.',
      content: {
        'application/json': {
          schema: z.object({ data: ExpenseByCategoryReportSchemaRef }),
        },
      },
    },
    ...errorResponses,
  },
})

// ---------------------------------------------------------------------------
// Recurring
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/recurring-transactions',
  tags: ['Recurring'],
  summary: 'List recurring transaction rules for the active tenant',
  security: sessionCookieAuth,
  responses: {
    200: dataResponse(
      'Recurring transaction rules.',
      z.object({ rules: z.array(RecurringTransactionRuleSchemaRef) }),
    ),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/recurring-transactions',
  tags: ['Recurring'],
  summary: 'Create a recurring transaction rule',
  security: sessionCookieAuth,
  request: {
    body: {
      content: {
        'application/json': { schema: CreateRecurringTransactionRuleSchemaRef },
      },
    },
  },
  responses: {
    201: dataResponse(
      'Recurring transaction rule created.',
      z.object({ rule: RecurringTransactionRuleSchemaRef }),
    ),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/internal/recurring/execute',
  tags: ['Recurring'],
  summary: 'Execute all due recurring transaction rules across tenants (internal/system endpoint)',
  security: internalKeyAuth,
  request: {
    body: { content: { 'application/json': { schema: ExecuteRecurringRequestSchema } } },
  },
  responses: {
    200: dataResponse('Execution summary.', ExecuteRecurringResultSchema),
    ...errorResponses,
  },
})

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/api/auth/session',
  tags: ['Auth'],
  summary: 'Create a session for an identity-provider-authenticated user (internal/system endpoint)',
  security: internalKeyAuth,
  request: {
    body: { content: { 'application/json': { schema: CreateSessionSchemaRef } } },
  },
  responses: {
    201: dataResponse('Session created.', CreateSessionResultSchema),
    ...errorResponses,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout',
  tags: ['Auth'],
  summary: 'Revoke the current session',
  security: sessionCookieAuth,
  responses: {
    200: dataResponse('Session revoked.', LogoutResultSchema),
    ...errorResponses,
  },
})

// ---------------------------------------------------------------------------
// Document generation
// ---------------------------------------------------------------------------

export function buildOpenApiDocument(): OpenAPIObject {
  const generator = new OpenApiGeneratorV3(registry.definitions)

  const document = generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Plinto API',
      version: '1.0.0',
      description:
        'Plinto REST API. Contracts are generated from the shared Zod schemas in ' +
        '`packages/shared` (see ADR 0002: Shared Contracts with Zod for REST) rather ' +
        'than from `@nestjs/swagger` decorators, since this codebase does not use ' +
        'class-validator.\n\n' +
        'Versioning: the API is currently served UNVERSIONED at `/api` for the MVP. ' +
        'When external clients are onboarded, versioning will be introduced via ' +
        "NestJS URI versioning (`VersioningType.URI`, e.g. `/api/v1/...`) rather than " +
        'a breaking change to the current paths. See ADR 0002 for details.',
    },
  })

  // `generateDocument` returns an openapi3-ts `OpenAPIObject`, which is
  // structurally equivalent to (but a distinct type from) the one exported by
  // `@nestjs/swagger`. Both represent the same OpenAPI 3 document shape.
  return document as unknown as OpenAPIObject
}
