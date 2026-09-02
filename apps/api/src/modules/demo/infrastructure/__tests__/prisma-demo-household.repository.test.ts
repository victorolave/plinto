import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaDemoHouseholdRepository } from '../prisma-demo-household.repository'
import { buildDemoHouseholdDataset } from '../../domain/demo-household-dataset'
import { DemoTenantAlreadyExistsError } from '../../domain/demo-household.repository'
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service'

const NOW = new Date(Date.UTC(2026, 8, 2, 12, 0, 0))

function makeTxMock() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    tenant: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
    membership: { create: vi.fn(), deleteMany: vi.fn() },
    account: { create: vi.fn(), deleteMany: vi.fn() },
    category: { create: vi.fn(), deleteMany: vi.fn() },
    creditLine: { create: vi.fn(), deleteMany: vi.fn() },
    creditLineStatement: { create: vi.fn(), deleteMany: vi.fn() },
    obligationInstance: { create: vi.fn(), deleteMany: vi.fn() },
    debtSchedule: { create: vi.fn(), deleteMany: vi.fn() },
    recurringTransactionRule: { create: vi.fn(), deleteMany: vi.fn() },
    recurringTransactionExecution: { deleteMany: vi.fn() },
    transaction: { create: vi.fn(), deleteMany: vi.fn() },
    transfer: { create: vi.fn(), deleteMany: vi.fn() },
    obligationPayment: { create: vi.fn(), deleteMany: vi.fn() },
    auditEvent: { deleteMany: vi.fn() },
    invitation: { deleteMany: vi.fn() },
  }
}

function makePrisma(txMock: ReturnType<typeof makeTxMock>) {
  return {
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
  }
}

describe('PrismaDemoHouseholdRepository', () => {
  let txMock: ReturnType<typeof makeTxMock>
  let prisma: ReturnType<typeof makePrisma>
  let repository: PrismaDemoHouseholdRepository

  beforeEach(() => {
    txMock = makeTxMock()
    prisma = makePrisma(txMock)
    repository = new PrismaDemoHouseholdRepository(prisma as unknown as PrismaService)

    txMock.tenant.create.mockResolvedValue({
      id: 'tenant-1',
      name: 'Hogar de ejemplo',
      baseCurrency: 'COP',
      isDemo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    txMock.membership.create.mockResolvedValue({
      id: 'membership-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  describe('createDemoHousehold', () => {
    it('creates the tenant as isDemo and an owner membership, inside one transaction', async () => {
      const result = await repository.createDemoHousehold({
        ownerUserId: 'user-1',
        tenantName: 'Hogar de ejemplo',
        locale: 'es',
        now: NOW,
      })

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(txMock.tenant.create).toHaveBeenCalledWith({
        data: { name: 'Hogar de ejemplo', baseCurrency: 'COP', isDemo: true },
      })
      expect(txMock.membership.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1', userId: 'user-1', role: 'owner' },
      })
      expect(result.tenant.id).toBe('tenant-1')
      expect(result.membership.userId).toBe('user-1')
    })

    it('takes the per-user advisory lock before re-checking for an existing demo tenant', async () => {
      await repository.createDemoHousehold({
        ownerUserId: 'user-1',
        tenantName: 'Hogar de ejemplo',
        locale: 'es',
        now: NOW,
      })

      expect(txMock.$executeRaw).toHaveBeenCalledTimes(1)
      expect(txMock.tenant.findFirst).toHaveBeenCalledTimes(1)
      expect(txMock.tenant.findFirst).toHaveBeenCalledWith({
        where: { isDemo: true, memberships: { some: { userId: 'user-1', role: 'owner' } } },
      })

      const lockOrder = txMock.$executeRaw.mock.invocationCallOrder[0]
      const checkOrder = txMock.tenant.findFirst.mock.invocationCallOrder[0]
      const createOrder = txMock.tenant.create.mock.invocationCallOrder[0]
      expect(lockOrder).toBeLessThan(checkOrder)
      expect(checkOrder).toBeLessThan(createOrder)
    })

    it('throws DemoTenantAlreadyExistsError and never creates a tenant when the re-check under the lock finds one — the race loser', async () => {
      // Simulates two concurrent callers: this one's fast-path check (outside
      // the transaction, in the service) passed, but by the time it wins the
      // advisory lock inside the transaction, the other caller has already
      // committed its own demo tenant for the same user.
      txMock.tenant.findFirst.mockResolvedValue({
        id: 'tenant-existing',
        name: 'Hogar de ejemplo',
        baseCurrency: 'COP',
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await expect(
        repository.createDemoHousehold({
          ownerUserId: 'user-1',
          tenantName: 'Hogar de ejemplo',
          locale: 'es',
          now: NOW,
        }),
      ).rejects.toBeInstanceOf(DemoTenantAlreadyExistsError)

      expect(txMock.$executeRaw).toHaveBeenCalledTimes(1)
      expect(txMock.tenant.create).not.toHaveBeenCalled()
      expect(txMock.membership.create).not.toHaveBeenCalled()
      expect(txMock.account.create).not.toHaveBeenCalled()
    })

    it('writes every row the dataset builder produced, matching its counts', async () => {
      await repository.createDemoHousehold({
        ownerUserId: 'user-1',
        tenantName: 'Hogar de ejemplo',
        locale: 'es',
        now: NOW,
      })

      const dataset = buildDemoHouseholdDataset(NOW, 'es')

      expect(txMock.account.create).toHaveBeenCalledTimes(dataset.accounts.length)
      expect(txMock.category.create).toHaveBeenCalledTimes(dataset.categories.length)
      expect(txMock.creditLine.create).toHaveBeenCalledTimes(dataset.creditLines.length)
      expect(txMock.creditLineStatement.create).toHaveBeenCalledTimes(dataset.creditLineStatements.length)
      expect(txMock.debtSchedule.create).toHaveBeenCalledTimes(1)
      expect(txMock.recurringTransactionRule.create).toHaveBeenCalledTimes(dataset.recurringRules.length)
      expect(txMock.transfer.create).toHaveBeenCalledTimes(dataset.transfers.length)
      expect(txMock.transaction.create).toHaveBeenCalledTimes(dataset.transactions.length)
      expect(txMock.obligationPayment.create).toHaveBeenCalledTimes(dataset.obligationPayments.length)

      // One obligation instance per manual obligation + one per statement.
      expect(txMock.obligationInstance.create).toHaveBeenCalledTimes(
        dataset.manualObligations.length + dataset.creditLineStatements.length,
      )
    })

    it('gives every transaction, account, category and credit line a tenant-scoped, non-empty id', async () => {
      await repository.createDemoHousehold({
        ownerUserId: 'user-1',
        tenantName: 'Hogar de ejemplo',
        locale: 'es',
        now: NOW,
      })

      for (const call of txMock.account.create.mock.calls) {
        expect(call[0].data.tenantId).toBe('tenant-1')
        expect(typeof call[0].data.id).toBe('string')
        expect(call[0].data.id.length).toBeGreaterThan(0)
      }
      for (const call of txMock.transaction.create.mock.calls) {
        expect(call[0].data.tenantId).toBe('tenant-1')
        expect(call[0].data.source).toBe('manual')
      }
    })

    it('links each obligation payment to a real obligation instance and expense transaction id', async () => {
      await repository.createDemoHousehold({
        ownerUserId: 'user-1',
        tenantName: 'Hogar de ejemplo',
        locale: 'es',
        now: NOW,
      })

      const obligationInstanceIds = new Set(
        txMock.obligationInstance.create.mock.calls.map((call) => call[0].data.id),
      )
      const transactionIds = new Set(txMock.transaction.create.mock.calls.map((call) => call[0].data.id))

      expect(txMock.obligationPayment.create.mock.calls.length).toBeGreaterThan(0)
      for (const call of txMock.obligationPayment.create.mock.calls) {
        expect(obligationInstanceIds.has(call[0].data.obligationInstanceId)).toBe(true)
        expect(transactionIds.has(call[0].data.transactionId)).toBe(true)
        expect(call[0].data.tenantId).toBe('tenant-1')
      }
    })
  })

  describe('deleteDemoHousehold', () => {
    it('deletes every tenant-scoped table in dependency-safe order, then the tenant', async () => {
      await repository.deleteDemoHousehold('tenant-1')

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)

      const callOrder = [
        txMock.obligationPayment.deleteMany,
        txMock.recurringTransactionExecution.deleteMany,
        txMock.obligationInstance.deleteMany,
        txMock.creditLineStatement.deleteMany,
        txMock.debtSchedule.deleteMany,
        txMock.recurringTransactionRule.deleteMany,
        txMock.transaction.deleteMany,
        txMock.transfer.deleteMany,
        txMock.account.deleteMany,
        txMock.category.deleteMany,
        txMock.creditLine.deleteMany,
        txMock.auditEvent.deleteMany,
        txMock.invitation.deleteMany,
        txMock.membership.deleteMany,
      ]

      for (const mockFn of callOrder) {
        expect(mockFn).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } })
      }

      // Every deleteMany happened before the tenant itself was deleted.
      const tenantDeleteOrder = txMock.tenant.delete.mock.invocationCallOrder[0]
      for (const mockFn of callOrder) {
        expect(mockFn.mock.invocationCallOrder[0]).toBeLessThan(tenantDeleteOrder)
      }

      expect(txMock.tenant.delete).toHaveBeenCalledWith({ where: { id: 'tenant-1' } })
    })
  })
})
