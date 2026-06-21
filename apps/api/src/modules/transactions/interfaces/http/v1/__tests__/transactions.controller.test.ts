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

  it('lists transactions using the resolved tenant context', async () => {
    const transactionService = {
      listTransactions: vi.fn().mockResolvedValue([{ id: 'tx-1' }]),
    }
    const controller = new TransactionsController(transactionService as any)

    const result = await controller.listTransactions(
      { tenantId: 'tenant-1' } as any,
      undefined,
    )

    expect(transactionService.listTransactions).toHaveBeenCalledWith('tenant-1', undefined)
    expect(result).toEqual({ data: { transactions: [{ id: 'tx-1' }] } })
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

  it('creates a transfer using the resolved tenant context', async () => {
    const transferResult = {
      transferId: 'transfer-uuid',
      debit: { id: 'tx-debit' },
      credit: { id: 'tx-credit' },
    }
    const transactionService = {
      createTransfer: vi.fn().mockResolvedValue(transferResult),
    }
    const controller = new TransactionsController(transactionService as any)

    const result = await controller.createTransfer(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as any,
      {
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-2',
        amountMinor: 5000,
      },
    )

    expect(transactionService.createTransfer).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      sourceAccountId: 'account-1',
      destinationAccountId: 'account-2',
      amountMinor: 5000,
      description: undefined,
      occurredAt: undefined,
    })
    expect(result).toEqual({ data: { transfer: transferResult } })
  })
})
