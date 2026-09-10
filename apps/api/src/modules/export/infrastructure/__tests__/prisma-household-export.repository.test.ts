import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaHouseholdExportRepository } from '../prisma-household-export.repository'
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service'

const emptyFindMany = () => vi.fn().mockResolvedValue([])

const makePrisma = () => ({
  tenant: { findUnique: vi.fn() },
  membership: { findMany: emptyFindMany() },
  category: { findMany: emptyFindMany() },
  account: { findMany: emptyFindMany() },
  creditLine: { findMany: emptyFindMany() },
  creditLineStatement: { findMany: emptyFindMany() },
  debtSchedule: { findMany: emptyFindMany() },
  recurringTransactionRule: { findMany: emptyFindMany() },
  transfer: { findMany: emptyFindMany() },
  transaction: { findMany: emptyFindMany() },
  recurringTransactionExecution: { findMany: emptyFindMany() },
  obligationInstance: { findMany: emptyFindMany() },
  obligationPayment: { findMany: emptyFindMany() },
  auditEvent: { findMany: emptyFindMany() },
})

describe('PrismaHouseholdExportRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repository: PrismaHouseholdExportRepository

  beforeEach(() => {
    prisma = makePrisma()
    repository = new PrismaHouseholdExportRepository(prisma as unknown as PrismaService)
  })

  describe('getHouseholdData', () => {
    it('returns null when the tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null)

      const result = await repository.getHouseholdData('missing-tenant')

      expect(result).toBeNull()
      expect(prisma.membership.findMany).not.toHaveBeenCalled()
    })

    it('joins membership rows down to the documented member shape', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Casa Olave',
        baseCurrency: 'COP',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      })
      prisma.membership.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          role: 'owner',
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          user: { email: 'victor@example.com', name: 'Victor' },
        },
      ])

      const result = await repository.getHouseholdData('tenant-1')

      expect(result?.members).toEqual([
        {
          userId: 'user-1',
          email: 'victor@example.com',
          name: 'Victor',
          role: 'owner',
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
        },
      ])
    })

    it('renders a Decimal fxRate as a string, and a null one as null', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Casa Olave',
        baseCurrency: 'COP',
        createdAt: new Date(),
      })
      prisma.transfer.findMany.mockResolvedValue([
        { id: 't1', fxRate: { toString: () => '4000.12345678' } },
        { id: 't2', fxRate: null },
      ])

      const result = await repository.getHouseholdData('tenant-1')

      expect(result?.transfers).toEqual([
        { id: 't1', fxRate: '4000.12345678' },
        { id: 't2', fxRate: null },
      ])
    })

    it('scopes and orders every query by tenantId, createdAt asc, id asc', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Casa Olave',
        baseCurrency: 'COP',
        createdAt: new Date(),
      })

      await repository.getHouseholdData('tenant-1')

      for (const model of [
        prisma.category,
        prisma.account,
        prisma.creditLine,
        prisma.creditLineStatement,
        prisma.debtSchedule,
        prisma.recurringTransactionRule,
        prisma.transfer,
        prisma.transaction,
        prisma.recurringTransactionExecution,
        prisma.obligationInstance,
        prisma.obligationPayment,
        prisma.auditEvent,
      ]) {
        expect(model.findMany).toHaveBeenCalledWith({
          where: { tenantId: 'tenant-1' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
      }
    })
  })

  describe('listTransactionsForCsv', () => {
    it('joins account, category, recurring rule and obligation names', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        {
          occurredAt: new Date('2026-01-01T00:00:00.000Z'),
          type: 'expense',
          amountMinor: 1000,
          currency: 'COP',
          description: 'Test',
          source: 'manual',
          transferId: null,
          account: { name: 'Cuenta principal' },
          category: { name: 'Mercado' },
          recurringRule: null,
          obligationPayment: { obligationInstance: { name: 'Arriendo — enero' } },
        },
      ])

      const rows = await repository.listTransactionsForCsv('tenant-1')

      expect(rows).toEqual([
        {
          occurredAt: new Date('2026-01-01T00:00:00.000Z'),
          type: 'expense',
          amountMinor: 1000,
          currency: 'COP',
          accountName: 'Cuenta principal',
          categoryName: 'Mercado',
          description: 'Test',
          source: 'manual',
          transferId: null,
          recurringRuleName: null,
          obligationName: 'Arriendo — enero',
        },
      ])
    })

    it('orders by occurredAt asc, id asc', async () => {
      await repository.listTransactionsForCsv('tenant-1')

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        }),
      )
    })
  })

  describe('getTenantName', () => {
    it('returns the tenant name', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ name: 'Casa Olave' })

      expect(await repository.getTenantName('tenant-1')).toBe('Casa Olave')
    })

    it('returns null when the tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null)

      expect(await repository.getTenantName('missing')).toBeNull()
    })
  })
})
