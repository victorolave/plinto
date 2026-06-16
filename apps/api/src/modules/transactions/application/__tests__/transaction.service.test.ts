import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { TransactionService } from '../transaction.service'

const makeAccount = (overrides = {}) => ({
  id: 'account-1',
  tenantId: 'tenant-1',
  name: 'Main bank account',
  type: 'bank' as const,
  currency: 'COP',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeTransaction = (overrides = {}) => ({
  id: 'tx-1',
  tenantId: 'tenant-1',
  accountId: 'account-1',
  type: 'income' as const,
  amountMinor: 10000,
  currency: 'COP',
  description: null,
  occurredAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeTransactionRepo = () => ({
  create: vi.fn(),
  listByTenantId: vi.fn(),
  listByAccountId: vi.fn(),
})

const makeAccountRepo = () => ({
  create: vi.fn(),
  listByTenantId: vi.fn(),
  findByIdForTenant: vi.fn(),
})

const makeAuditService = () => ({
  record: vi.fn(),
})

describe('TransactionService', () => {
  let transactionRepository: ReturnType<typeof makeTransactionRepo>
  let accountRepository: ReturnType<typeof makeAccountRepo>
  let auditService: ReturnType<typeof makeAuditService>
  let service: TransactionService

  beforeEach(() => {
    transactionRepository = makeTransactionRepo()
    accountRepository = makeAccountRepo()
    auditService = makeAuditService()
    service = new TransactionService(
      transactionRepository as any,
      accountRepository as any,
      auditService as any,
    )
  })

  describe('createTransaction', () => {
    it('creates a transaction with currency derived from the account', async () => {
      const account = makeAccount({ currency: 'COP' })
      const transaction = makeTransaction({ currency: 'COP' })
      accountRepository.findByIdForTenant.mockResolvedValue(account)
      transactionRepository.create.mockResolvedValue(transaction)
      auditService.record.mockResolvedValue(undefined)

      const result = await service.createTransaction({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        requestId: 'req-1',
        accountId: 'account-1',
        type: 'income',
        amountMinor: 10000,
      })

      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'COP' }),
      )
      expect(result).toBe(transaction)
    })

    it('throws NotFoundException when account not found for tenant', async () => {
      accountRepository.findByIdForTenant.mockResolvedValue(null)

      await expect(
        service.createTransaction({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          requestId: 'req-1',
          accountId: 'account-999',
          type: 'income',
          amountMinor: 5000,
        }),
      ).rejects.toThrow(NotFoundException)

      expect(transactionRepository.create).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('records an audit event with action transaction.income', async () => {
      const account = makeAccount()
      const transaction = makeTransaction()
      accountRepository.findByIdForTenant.mockResolvedValue(account)
      transactionRepository.create.mockResolvedValue(transaction)
      auditService.record.mockResolvedValue(undefined)

      await service.createTransaction({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        requestId: 'req-1',
        accountId: 'account-1',
        type: 'income',
        amountMinor: 10000,
      })

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'transaction.income' }),
      )
    })

    it('records an audit event with action transaction.expense', async () => {
      const account = makeAccount()
      const transaction = makeTransaction({ type: 'expense' })
      accountRepository.findByIdForTenant.mockResolvedValue(account)
      transactionRepository.create.mockResolvedValue(transaction)
      auditService.record.mockResolvedValue(undefined)

      await service.createTransaction({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        requestId: 'req-1',
        accountId: 'account-1',
        type: 'expense',
        amountMinor: 3000,
      })

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'transaction.expense' }),
      )
    })
  })

  describe('listTransactions', () => {
    it('returns all transactions for a tenant when no accountId filter', async () => {
      const transactions = [makeTransaction(), makeTransaction({ id: 'tx-2', accountId: 'account-2' })]
      transactionRepository.listByTenantId.mockResolvedValue(transactions)

      const result = await service.listTransactions('tenant-1')

      expect(transactionRepository.listByTenantId).toHaveBeenCalledWith('tenant-1')
      expect(result).toBe(transactions)
    })

    it('filters transactions by accountId at the repository level when provided', async () => {
      const tx1 = makeTransaction({ id: 'tx-1', accountId: 'account-1' })
      transactionRepository.listByAccountId.mockResolvedValue([tx1])

      const result = await service.listTransactions('tenant-1', 'account-1')

      expect(transactionRepository.listByAccountId).toHaveBeenCalledWith('tenant-1', 'account-1')
      expect(transactionRepository.listByTenantId).not.toHaveBeenCalled()
      expect(result).toEqual([tx1])
    })
  })

  describe('getBalances', () => {
    it('computes income minus expense per account', async () => {
      const account = makeAccount()
      const income = makeTransaction({ type: 'income', amountMinor: 10000 })
      const expense = makeTransaction({ id: 'tx-2', type: 'expense', amountMinor: 3000 })
      accountRepository.listByTenantId.mockResolvedValue([account])
      transactionRepository.listByTenantId.mockResolvedValue([income, expense])

      const result = await service.getBalances('tenant-1')

      expect(result).toEqual([
        {
          accountId: 'account-1',
          accountName: 'Main bank account',
          currency: 'COP',
          balanceMinor: 7000,
        },
      ])
    })

    it('returns one balance entry per account in the same order as accounts', async () => {
      const account1 = makeAccount({ id: 'account-1', name: 'Account 1' })
      const account2 = makeAccount({ id: 'account-2', name: 'Account 2', currency: 'USD' })
      accountRepository.listByTenantId.mockResolvedValue([account1, account2])
      transactionRepository.listByTenantId.mockResolvedValue([])

      const result = await service.getBalances('tenant-1')

      expect(result).toHaveLength(2)
      expect(result[0].accountId).toBe('account-1')
      expect(result[1].accountId).toBe('account-2')
    })
  })
})
