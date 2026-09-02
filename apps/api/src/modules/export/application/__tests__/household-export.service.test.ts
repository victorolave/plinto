import { describe, expect, it, vi } from 'vitest'
import { HouseholdExportService } from '../household-export.service'
import type { HouseholdExportData, TransactionCsvRow } from '../../domain/household-export.entity'

function buildData(overrides: Partial<HouseholdExportData> = {}): HouseholdExportData {
  return {
    tenant: {
      id: 'tenant-1',
      name: 'Casa Olave',
      baseCurrency: 'COP',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    },
    members: [
      {
        userId: 'user-1',
        email: 'victor@example.com',
        name: 'Victor',
        role: 'owner',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    ],
    categories: [],
    accounts: [],
    creditLines: [],
    creditLineStatements: [],
    debtSchedules: [],
    recurringRules: [],
    transfers: [],
    transactions: [],
    recurringExecutions: [],
    obligationInstances: [],
    obligationPayments: [],
    auditEvents: [],
    ...overrides,
  }
}

function buildService(overrides: {
  getHouseholdData?: (tenantId: string) => Promise<HouseholdExportData | null>
  listTransactionsForCsv?: (tenantId: string) => Promise<TransactionCsvRow[]>
  getTenantName?: (tenantId: string) => Promise<string | null>
} = {}) {
  const repository = {
    getHouseholdData: vi.fn(overrides.getHouseholdData ?? (async () => buildData())),
    listTransactionsForCsv: vi.fn(overrides.listTransactionsForCsv ?? (async () => [])),
    getTenantName: vi.fn(overrides.getTenantName ?? (async () => 'Casa Olave')),
  }
  const auditService = { record: vi.fn().mockResolvedValue(undefined) }

  const service = new HouseholdExportService(
    repository as never,
    auditService as never,
  )

  return { service, repository, auditService }
}

describe('HouseholdExportService', () => {
  describe('exportHousehold', () => {
    it('returns a filename derived from the tenant name and the export date', async () => {
      const { service } = buildService()

      const { filename } = await service.exportHousehold({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
      })

      expect(filename).toMatch(/^plinto-casa-olave-\d{4}-\d{2}-\d{2}\.json$/)
    })

    it('serializes the bundle the pure builder produces', async () => {
      const { service } = buildService()

      const { json } = await service.exportHousehold({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
      })

      const parsed = JSON.parse(json)
      expect(parsed.format).toBe('plinto-household-export')
      expect(parsed.tenant.id).toBe('tenant-1')
    })

    it('records tenant.exported with the format and row counts, before returning', async () => {
      const { service, auditService } = buildService({
        getHouseholdData: async () =>
          buildData({
            accounts: [
              {
                id: 'a1',
                tenantId: 'tenant-1',
                name: 'Cuenta',
                type: 'bank',
                currency: 'COP',
                createdAt: new Date(),
                updatedAt: new Date(),
                archivedAt: null,
              },
            ],
          }),
      })

      await service.exportHousehold({
        tenantId: 'tenant-1',
        actorUserId: 'user-42',
        correlationId: 'req-9',
      })

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          actorUserId: 'user-42',
          action: 'tenant.exported',
          resourceType: 'tenant',
          resourceId: 'tenant-1',
          correlationId: 'req-9',
          metadata: expect.objectContaining({
            format: 'json',
            counts: expect.objectContaining({ members: 1, accounts: 1, categories: 0 }),
          }),
        }),
      )
    })

    it('throws NOT_FOUND rather than exporting nothing when the tenant is missing', async () => {
      const { service } = buildService({ getHouseholdData: async () => null })

      await expect(
        service.exportHousehold({ tenantId: 'gone', actorUserId: null, correlationId: 'r' }),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TENANT_NOT_FOUND' }) })
    })

    it('propagates a repository failure without recording an audit event', async () => {
      const { service, auditService } = buildService({
        getHouseholdData: async () => {
          throw new Error('database unreachable')
        },
      })

      await expect(
        service.exportHousehold({ tenantId: 'tenant-1', actorUserId: null, correlationId: 'r' }),
      ).rejects.toThrow('database unreachable')

      expect(auditService.record).not.toHaveBeenCalled()
    })
  })

  describe('exportTransactionsCsv', () => {
    it('returns a filename derived from the tenant name, with the transactions suffix', async () => {
      const { service } = buildService()

      const { filename } = await service.exportTransactionsCsv({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
      })

      expect(filename).toMatch(/^plinto-casa-olave-transactions-\d{4}-\d{2}-\d{2}\.csv$/)
    })

    it('records tenant.exported with format csv and the row count', async () => {
      const rows: TransactionCsvRow[] = [
        {
          occurredAt: new Date(),
          type: 'expense',
          amountMinor: 1000,
          currency: 'COP',
          accountName: 'Cuenta',
          categoryName: null,
          description: null,
          source: 'manual',
          transferId: null,
          recurringRuleName: null,
          obligationName: null,
        },
      ]
      const { service, auditService } = buildService({
        listTransactionsForCsv: async () => rows,
      })

      await service.exportTransactionsCsv({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
      })

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.exported',
          metadata: { format: 'csv', counts: { transactions: 1 } },
        }),
      )
    })

    it('propagates a repository failure before any header could be set, without auditing', async () => {
      const { service, auditService } = buildService({
        getTenantName: async () => {
          throw new Error('database unreachable')
        },
      })

      await expect(
        service.exportTransactionsCsv({
          tenantId: 'tenant-1',
          actorUserId: null,
          correlationId: 'r',
        }),
      ).rejects.toThrow('database unreachable')

      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('throws NOT_FOUND when the tenant is missing', async () => {
      const { service } = buildService({ getTenantName: async () => null })

      await expect(
        service.exportTransactionsCsv({ tenantId: 'gone', actorUserId: null, correlationId: 'r' }),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TENANT_NOT_FOUND' }) })
    })
  })
})
