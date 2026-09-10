import 'reflect-metadata'
import { Reflector } from '@nestjs/core'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_KEY } from '../../../../../../common/guards/role.guard'
import { TransactionsController } from '../transactions.controller'

describe('TransactionsController', () => {
  it('requires read permission to list transactions', () => {
    const reflector = new Reflector()
    const permission = reflector.get(
      PERMISSION_KEY,
      TransactionsController.prototype.listTransactions,
    )
    expect(permission).toBe('transaction:read')
  })

  it('requires read permission to list balances', () => {
    const reflector = new Reflector()
    const permission = reflector.get(
      PERMISSION_KEY,
      TransactionsController.prototype.listBalances,
    )
    expect(permission).toBe('transaction:read')
  })

  it('requires write permission to create a transaction', () => {
    const reflector = new Reflector()
    const permission = reflector.get(
      PERMISSION_KEY,
      TransactionsController.prototype.createTransaction,
    )
    expect(permission).toBe('transaction:write')
  })

  it('requires write permission to update a transaction', () => {
    const reflector = new Reflector()
    const permission = reflector.get(
      PERMISSION_KEY,
      TransactionsController.prototype.updateTransaction,
    )
    expect(permission).toBe('transaction:write')
  })

  it('lists transactions using the resolved tenant context, defaulting page and pageSize', async () => {
    const transactionService = {
      listTransactions: vi
        .fn()
        .mockResolvedValue({ transactions: [{ id: 'tx-1' }], total: 1, counts: { income: 1, expense: 0 } }),
    }
    const controller = new TransactionsController(transactionService as any)

    const result = await controller.listTransactions({ tenantId: 'tenant-1' } as any, {})

    expect(transactionService.listTransactions).toHaveBeenCalledWith('tenant-1', {
      page: 1,
      pageSize: 50,
    })
    expect(result).toEqual({
      data: { transactions: [{ id: 'tx-1' }] },
      meta: {
        pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
        counts: { income: 1, expense: 0 },
      },
    })
  })

  it('computes totalPages from total and pageSize', async () => {
    const transactionService = {
      listTransactions: vi
        .fn()
        .mockResolvedValue({ transactions: [], total: 125, counts: { income: 25, expense: 100 } }),
    }
    const controller = new TransactionsController(transactionService as any)

    const result = await controller.listTransactions({ tenantId: 'tenant-1' } as any, {
      page: '1',
      pageSize: '50',
    })

    expect(result).toEqual({
      data: { transactions: [] },
      meta: {
        pagination: { page: 1, pageSize: 50, total: 125, totalPages: 3 },
        counts: { income: 25, expense: 100 },
      },
    })
  })

  it('rejects a pageSize above 100 with a validation error (max cap enforced)', async () => {
    const transactionService = {
      listTransactions: vi.fn(),
    }
    const controller = new TransactionsController(transactionService as any)

    await expect(
      controller.listTransactions({ tenantId: 'tenant-1' } as any, {
        page: '1',
        pageSize: '500',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    })

    expect(transactionService.listTransactions).not.toHaveBeenCalled()
  })

  /**
   * The filters moved out of the browser when the ledger was paginated, so the
   * endpoint is now the only place they are applied. Anything it drops here is
   * a filter the reader set and the results silently ignore.
   */
  it('passes every filter through to the service alongside pagination', async () => {
    const transactionService = {
      listTransactions: vi
        .fn()
        .mockResolvedValue({ transactions: [], total: 0, counts: { income: 0, expense: 0 } }),
    }
    const controller = new TransactionsController(transactionService as any)

    await controller.listTransactions({ tenantId: 'tenant-1' } as any, {
      accountId: 'account-1',
      type: 'expense',
      search: 'mercado',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      page: '2',
      pageSize: '10',
    })

    expect(transactionService.listTransactions).toHaveBeenCalledWith('tenant-1', {
      accountId: 'account-1',
      type: 'expense',
      search: 'mercado',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      page: 2,
      pageSize: 10,
    })
  })

  /**
   * The tabs read these, and the tabs are what sets the type filter. Reporting
   * them per page would relabel the tabs every time the reader turned one.
   */
  it('reports type counts for the whole filtered set, not for the page', async () => {
    const transactionService = {
      listTransactions: vi
        .fn()
        .mockResolvedValue({ transactions: [], total: 100, counts: { income: 30, expense: 70 } }),
    }
    const controller = new TransactionsController(transactionService as any)

    const result = await controller.listTransactions({ tenantId: 'tenant-1' } as any, {
      pageSize: '10',
    })

    expect(result.meta.counts).toEqual({ income: 30, expense: 70 })
    expect(result.meta.pagination.totalPages).toBe(10)
  })

  it('reads a cleared filter as no filter rather than as an empty match', async () => {
    const transactionService = {
      listTransactions: vi
        .fn()
        .mockResolvedValue({ transactions: [], total: 0, counts: { income: 0, expense: 0 } }),
    }
    const controller = new TransactionsController(transactionService as any)

    await controller.listTransactions({ tenantId: 'tenant-1' } as any, {
      accountId: '',
      search: '  ',
      type: '',
    })

    expect(transactionService.listTransactions).toHaveBeenCalledWith('tenant-1', {
      page: 1,
      pageSize: 50,
    })
  })

  it('rejects a date that is not a real calendar day', async () => {
    const transactionService = { listTransactions: vi.fn() }
    const controller = new TransactionsController(transactionService as any)

    await expect(
      controller.listTransactions({ tenantId: 'tenant-1' } as any, { dateFrom: '2026-02-30' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    })

    expect(transactionService.listTransactions).not.toHaveBeenCalled()
  })

  it('lists balances using the resolved tenant context', async () => {
    const transactionService = {
      getBalances: vi.fn().mockResolvedValue([{ accountId: 'account-1', balanceMinor: 5000 }]),
    }
    const controller = new TransactionsController(transactionService as any)

    const result = await controller.listBalances({ tenantId: 'tenant-1' } as any)

    expect(transactionService.getBalances).toHaveBeenCalledWith('tenant-1')
    expect(result).toEqual({
      data: { balances: [{ accountId: 'account-1', balanceMinor: 5000 }] },
    })
  })

  it('creates a transaction using the resolved tenant context', async () => {
    const transactionService = {
      createTransaction: vi.fn().mockResolvedValue({ id: 'tx-1' }),
    }
    const controller = new TransactionsController(transactionService as any)

    const result = await controller.createTransaction(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as any,
      {
        accountId: 'account-1',
        type: 'income',
        amountMinor: 10000,
      },
    )

    expect(transactionService.createTransaction).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      requestId: 'req-1',
      accountId: 'account-1',
      type: 'income',
      amountMinor: 10000,
      description: undefined,
      occurredAt: undefined,
    })
    expect(result).toEqual({ data: { transaction: { id: 'tx-1' } } })
  })

  it('updates a transaction using the resolved tenant context', async () => {
    const transactionService = {
      updateTransaction: vi.fn().mockResolvedValue({ id: 'tx-1' }),
    }
    const controller = new TransactionsController(transactionService as any)

    const result = await controller.updateTransaction(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as any,
      'tx-1',
      {
        amountMinor: 12500,
        description: 'Corrected amount',
      },
    )

    expect(transactionService.updateTransaction).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      requestId: 'req-1',
      transactionId: 'tx-1',
      accountId: undefined,
      type: undefined,
      amountMinor: 12500,
      description: 'Corrected amount',
      occurredAt: undefined,
    })
    expect(result).toEqual({ data: { transaction: { id: 'tx-1' } } })
  })

  it('requires write permission to create a transfer', () => {
    const reflector = new Reflector()
    const permission = reflector.get(
      PERMISSION_KEY,
      TransactionsController.prototype.createTransfer,
    )
    expect(permission).toBe('transaction:write')
  })

  it('creates a transfer using the resolved tenant context, responding 201 with no Idempotency-Key', async () => {
    const transferResult = {
      transfer: { id: 'transfer-uuid' },
      debit: { id: 'tx-debit' },
      credit: { id: 'tx-credit' },
      alreadyExisted: false,
    }
    const transactionService = {
      createTransfer: vi.fn().mockResolvedValue(transferResult),
    }
    const controller = new TransactionsController(transactionService as any)
    const res = { status: vi.fn() }

    const result = await controller.createTransfer(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as any,
      {
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-2',
        sourceAmountMinor: 5000,
      },
      undefined,
      res as any,
    )

    expect(transactionService.createTransfer).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      sourceAccountId: 'account-1',
      destinationAccountId: 'account-2',
      sourceAmountMinor: 5000,
      destinationAmountMinor: undefined,
      fxRate: undefined,
      feeMinor: undefined,
      description: undefined,
      occurredAt: undefined,
      idempotencyKey: undefined,
    })
    expect(res.status).toHaveBeenCalledWith(201)
    // `alreadyExisted` travels in the body too, not only as the status code:
    // apps/web's own apiFetch discards the status, so the body is the only
    // place a caller that cannot read it can tell a replay from a creation.
    expect(result).toEqual({ data: transferResult })
  })

  it('forwards the Idempotency-Key header to the service', async () => {
    const transferResult = {
      transfer: { id: 'transfer-uuid' },
      debit: { id: 'tx-debit' },
      credit: { id: 'tx-credit' },
      alreadyExisted: false,
    }
    const transactionService = {
      createTransfer: vi.fn().mockResolvedValue(transferResult),
    }
    const controller = new TransactionsController(transactionService as any)
    const res = { status: vi.fn() }

    await controller.createTransfer(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as any,
      {
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-2',
        sourceAmountMinor: 5000,
      },
      'retry-key-1',
      res as any,
    )

    expect(transactionService.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'retry-key-1' }),
    )
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('responds 200 with the original transfer on a repeated Idempotency-Key', async () => {
    const transferResult = {
      transfer: { id: 'transfer-uuid' },
      debit: { id: 'tx-debit' },
      credit: { id: 'tx-credit' },
      alreadyExisted: true,
    }
    const transactionService = {
      createTransfer: vi.fn().mockResolvedValue(transferResult),
    }
    const controller = new TransactionsController(transactionService as any)
    const res = { status: vi.fn() }

    const result = await controller.createTransfer(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as any,
      {
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-2',
        sourceAmountMinor: 5000,
      },
      'retry-key-1',
      res as any,
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(result).toEqual({ data: transferResult })
  })
})
