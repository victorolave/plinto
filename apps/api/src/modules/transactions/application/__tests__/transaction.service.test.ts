import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
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
  createTransfer: vi.fn(),
  findByIdForTenant: vi.fn(),
  updateForTenant: vi.fn(),
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

  describe('createTransfer', () => {
    const makeTransfer = (overrides = {}) => ({
      id: 'transfer-uuid',
      tenantId: 'tenant-1',
      sourceAccountId: 'account-1',
      destinationAccountId: 'account-2',
      sourceAmountMinor: 5000,
      destinationAmountMinor: 5000,
      sourceCurrency: 'COP',
      destinationCurrency: 'COP',
      fxRate: null,
      feeMinor: null,
      rateSource: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })
    const makeDebitTx = (overrides = {}) => ({
      ...makeTransaction({ id: 'tx-debit', type: 'expense' as const, accountId: 'account-1' }),
      transferId: 'transfer-uuid',
      ...overrides,
    })
    const makeCreditTx = (overrides = {}) => ({
      ...makeTransaction({ id: 'tx-credit', type: 'income' as const, accountId: 'account-2' }),
      transferId: 'transfer-uuid',
      ...overrides,
    })

    it('same-currency: creates a transfer row (fxRate null) and two legs with matching amounts', async () => {
      const sourceAccount = makeAccount({ id: 'account-1', currency: 'COP' })
      const destAccount = makeAccount({ id: 'account-2', currency: 'COP' })
      const transfer = makeTransfer()
      const debitTx = makeDebitTx()
      const creditTx = makeCreditTx()
      accountRepository.findByIdForTenant
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount)
      transactionRepository.createTransfer.mockResolvedValue({ transfer, debit: debitTx, credit: creditTx })
      auditService.record.mockResolvedValue(undefined)

      const result = await service.createTransfer({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-2',
        sourceAmountMinor: 5000,
      })

      expect(transactionRepository.createTransfer).toHaveBeenCalledTimes(1)
      const callArg = transactionRepository.createTransfer.mock.calls[0][0]
      expect(callArg.sourceAmountMinor).toBe(5000)
      expect(callArg.destinationAmountMinor).toBe(5000)
      expect(callArg.fxRate).toBeNull()
      expect(callArg.rateSource).toBeNull()
      expect(callArg.sourceCurrency).toBe('COP')
      expect(callArg.destinationCurrency).toBe('COP')
      expect(result.transfer).toBe(transfer)
      expect(result.debit).toBe(debitTx)
      expect(result.credit).toBe(creditTx)
    })

    it('cross-currency: creates a transfer row with fxRate and rateSource=manual, preserves exact amounts', async () => {
      const sourceAccount = makeAccount({ id: 'account-1', currency: 'COP' })
      const destAccount = makeAccount({ id: 'account-2', currency: 'USD' })
      const transfer = makeTransfer({
        sourceCurrency: 'COP',
        destinationCurrency: 'USD',
        sourceAmountMinor: 420000,
        destinationAmountMinor: 100,
        fxRate: '4200.00',
        rateSource: 'manual',
      })
      const debitTx = makeDebitTx({ currency: 'COP', amountMinor: 420000 })
      const creditTx = makeCreditTx({ currency: 'USD', amountMinor: 100, accountId: 'account-2' })
      accountRepository.findByIdForTenant
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount)
      transactionRepository.createTransfer.mockResolvedValue({ transfer, debit: debitTx, credit: creditTx })
      auditService.record.mockResolvedValue(undefined)

      const result = await service.createTransfer({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-2',
        sourceAmountMinor: 420000,
        destinationAmountMinor: 100,
        fxRate: '4200.00',
      })

      const callArg = transactionRepository.createTransfer.mock.calls[0][0]
      expect(callArg.sourceAmountMinor).toBe(420000)
      expect(callArg.destinationAmountMinor).toBe(100)
      expect(callArg.fxRate).toBe('4200.00')
      expect(callArg.rateSource).toBe('manual')
      expect(callArg.sourceCurrency).toBe('COP')
      expect(callArg.destinationCurrency).toBe('USD')
      expect(result.transfer).toBe(transfer)
    })

    it('cross-currency: rejects when fxRate is missing', async () => {
      const sourceAccount = makeAccount({ id: 'account-1', currency: 'COP' })
      const destAccount = makeAccount({ id: 'account-2', currency: 'USD' })
      accountRepository.findByIdForTenant
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount)

      await expect(
        service.createTransfer({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          sourceAccountId: 'account-1',
          destinationAccountId: 'account-2',
          sourceAmountMinor: 420000,
          destinationAmountMinor: 100,
        }),
      ).rejects.toThrow(UnprocessableEntityException)

      expect(transactionRepository.createTransfer).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('cross-currency: rejects when destinationAmountMinor is missing', async () => {
      const sourceAccount = makeAccount({ id: 'account-1', currency: 'COP' })
      const destAccount = makeAccount({ id: 'account-2', currency: 'USD' })
      accountRepository.findByIdForTenant
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount)

      await expect(
        service.createTransfer({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          sourceAccountId: 'account-1',
          destinationAccountId: 'account-2',
          sourceAmountMinor: 420000,
          fxRate: '4200.00',
        }),
      ).rejects.toThrow(UnprocessableEntityException)

      expect(transactionRepository.createTransfer).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('same-currency: rejects when fxRate is present', async () => {
      const sourceAccount = makeAccount({ id: 'account-1', currency: 'COP' })
      const destAccount = makeAccount({ id: 'account-2', currency: 'COP' })
      accountRepository.findByIdForTenant
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount)

      await expect(
        service.createTransfer({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          sourceAccountId: 'account-1',
          destinationAccountId: 'account-2',
          sourceAmountMinor: 5000,
          fxRate: '1.0',
        }),
      ).rejects.toThrow(BadRequestException)

      expect(transactionRepository.createTransfer).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('same-currency: rejects when feeMinor is present', async () => {
      const sourceAccount = makeAccount({ id: 'account-1', currency: 'COP' })
      const destAccount = makeAccount({ id: 'account-2', currency: 'COP' })
      accountRepository.findByIdForTenant
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount)

      await expect(
        service.createTransfer({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          sourceAccountId: 'account-1',
          destinationAccountId: 'account-2',
          sourceAmountMinor: 5000,
          feeMinor: 100,
        }),
      ).rejects.toThrow(BadRequestException)

      expect(transactionRepository.createTransfer).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('same-currency: rejects when destinationAmountMinor differs from sourceAmountMinor', async () => {
      const sourceAccount = makeAccount({ id: 'account-1', currency: 'COP' })
      const destAccount = makeAccount({ id: 'account-2', currency: 'COP' })
      accountRepository.findByIdForTenant
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount)

      await expect(
        service.createTransfer({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          sourceAccountId: 'account-1',
          destinationAccountId: 'account-2',
          sourceAmountMinor: 5000,
          destinationAmountMinor: 9999,
        }),
      ).rejects.toThrow(BadRequestException)

      expect(transactionRepository.createTransfer).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when source account is outside the tenant', async () => {
      accountRepository.findByIdForTenant
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeAccount({ id: 'account-2' }))

      await expect(
        service.createTransfer({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          sourceAccountId: 'account-999',
          destinationAccountId: 'account-2',
          sourceAmountMinor: 5000,
        }),
      ).rejects.toThrow(NotFoundException)

      expect(transactionRepository.createTransfer).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when destination account is outside the tenant', async () => {
      accountRepository.findByIdForTenant
        .mockResolvedValueOnce(makeAccount({ id: 'account-1' }))
        .mockResolvedValueOnce(null)

      await expect(
        service.createTransfer({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          sourceAccountId: 'account-1',
          destinationAccountId: 'account-999',
          sourceAmountMinor: 5000,
        }),
      ).rejects.toThrow(NotFoundException)

      expect(transactionRepository.createTransfer).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('throws UnprocessableEntityException when source equals destination', async () => {
      await expect(
        service.createTransfer({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          sourceAccountId: 'account-1',
          destinationAccountId: 'account-1',
          sourceAmountMinor: 5000,
        }),
      ).rejects.toThrow(UnprocessableEntityException)

      expect(accountRepository.findByIdForTenant).not.toHaveBeenCalled()
      expect(transactionRepository.createTransfer).not.toHaveBeenCalled()
    })

    it('emits two transaction.transfer audit events with FX metadata', async () => {
      const sourceAccount = makeAccount({ id: 'account-1', currency: 'COP' })
      const destAccount = makeAccount({ id: 'account-2', currency: 'USD' })
      const transfer = makeTransfer({ sourceCurrency: 'COP', destinationCurrency: 'USD', fxRate: '4200.00', rateSource: 'manual', destinationAmountMinor: 100 })
      const debitTx = makeDebitTx({ currency: 'COP' })
      const creditTx = makeCreditTx({ currency: 'USD' })
      accountRepository.findByIdForTenant
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount)
      transactionRepository.createTransfer.mockResolvedValue({ transfer, debit: debitTx, credit: creditTx })
      auditService.record.mockResolvedValue(undefined)

      await service.createTransfer({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-2',
        sourceAmountMinor: 5000,
        destinationAmountMinor: 100,
        fxRate: '4200.00',
      })

      expect(auditService.record).toHaveBeenCalledTimes(2)
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'transaction.transfer',
          resourceId: 'tx-debit',
          metadata: expect.objectContaining({ direction: 'debit', fxRate: expect.stringMatching(/^4200(\.0+)?$/) }),
        }),
      )
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'transaction.transfer',
          resourceId: 'tx-credit',
          metadata: expect.objectContaining({ direction: 'credit', fxRate: expect.stringMatching(/^4200(\.0+)?$/) }),
        }),
      )
    })
  })

  describe('updateTransaction', () => {
    it('updates a transaction and records before/after audit metadata', async () => {
      const existing = makeTransaction({
        amountMinor: 10000,
        description: 'Initial amount',
      })
      const updated = makeTransaction({
        amountMinor: 12500,
        description: 'Corrected amount',
      })
      transactionRepository.findByIdForTenant.mockResolvedValue(existing)
      transactionRepository.updateForTenant.mockResolvedValue(updated)
      auditService.record.mockResolvedValue(undefined)

      const result = await service.updateTransaction({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        requestId: 'req-1',
        transactionId: 'tx-1',
        amountMinor: 12500,
        description: 'Corrected amount',
      })

      expect(transactionRepository.updateForTenant).toHaveBeenCalledWith(
        'tx-1',
        'tenant-1',
        expect.objectContaining({
          amountMinor: 12500,
          description: 'Corrected amount',
        }),
      )
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'transaction.updated',
          resourceType: 'transaction',
          resourceId: 'tx-1',
          metadata: {
            before: expect.objectContaining({
              amountMinor: 10000,
              description: 'Initial amount',
            }),
            after: expect.objectContaining({
              amountMinor: 12500,
              description: 'Corrected amount',
            }),
          },
        }),
      )
      expect(result).toBe(updated)
    })

    it('derives currency from the new account when moving a transaction', async () => {
      const existing = makeTransaction({
        accountId: 'account-1',
        currency: 'COP',
      })
      const newAccount = makeAccount({
        id: 'account-2',
        currency: 'USD',
      })
      const updated = makeTransaction({
        accountId: 'account-2',
        currency: 'USD',
      })
      transactionRepository.findByIdForTenant.mockResolvedValue(existing)
      accountRepository.findByIdForTenant.mockResolvedValue(newAccount)
      transactionRepository.updateForTenant.mockResolvedValue(updated)
      auditService.record.mockResolvedValue(undefined)

      await service.updateTransaction({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        requestId: 'req-1',
        transactionId: 'tx-1',
        accountId: 'account-2',
      })

      expect(accountRepository.findByIdForTenant).toHaveBeenCalledWith(
        'account-2',
        'tenant-1',
      )
      expect(transactionRepository.updateForTenant).toHaveBeenCalledWith(
        'tx-1',
        'tenant-1',
        expect.objectContaining({
          accountId: 'account-2',
          currency: 'USD',
        }),
      )
    })

    it('throws NotFoundException when transaction is not in the active tenant', async () => {
      transactionRepository.findByIdForTenant.mockResolvedValue(null)

      await expect(
        service.updateTransaction({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          requestId: 'req-1',
          transactionId: 'tx-999',
          amountMinor: 5000,
        }),
      ).rejects.toThrow(NotFoundException)

      expect(transactionRepository.updateForTenant).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('throws NotFoundException and skips audit when target account is outside tenant', async () => {
      transactionRepository.findByIdForTenant.mockResolvedValue(makeTransaction())
      accountRepository.findByIdForTenant.mockResolvedValue(null)

      await expect(
        service.updateTransaction({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          requestId: 'req-1',
          transactionId: 'tx-1',
          accountId: 'account-999',
        }),
      ).rejects.toThrow(NotFoundException)

      expect(transactionRepository.updateForTenant).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
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
