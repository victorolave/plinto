import 'reflect-metadata'
import { Reflector } from '@nestjs/core'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_KEY } from '../../../../../../common/guards/role.guard'
import { AccountsController } from '../accounts.controller'

describe('AccountsController', () => {
  it('requires read permission to list accounts', () => {
    const reflector = new Reflector()

    const permission = reflector.get(
      PERMISSION_KEY,
      AccountsController.prototype.listAccounts,
    )

    expect(permission).toBe('account:read')
  })

  it('requires write permission to create an account', () => {
    const reflector = new Reflector()

    const permission = reflector.get(
      PERMISSION_KEY,
      AccountsController.prototype.createAccount,
    )

    expect(permission).toBe('account:write')
  })

  it('requires write permission to update an account', () => {
    const reflector = new Reflector()

    const permission = reflector.get(
      PERMISSION_KEY,
      AccountsController.prototype.updateAccount,
    )

    expect(permission).toBe('account:write')
  })

  it('requires write permission to restore an account', () => {
    const reflector = new Reflector()

    const permission = reflector.get(
      PERMISSION_KEY,
      AccountsController.prototype.restoreAccount,
    )

    expect(permission).toBe('account:write')
  })

  it('requires delete permission to archive an account', () => {
    const reflector = new Reflector()

    const permission = reflector.get(
      PERMISSION_KEY,
      AccountsController.prototype.archiveAccount,
    )

    expect(permission).toBe('account:delete')
  })

  it('lists active accounts using the resolved tenant context', async () => {
    const accountService = {
      listAccounts: vi.fn().mockResolvedValue([{ id: 'account-1' }]),
    }
    const controller = new AccountsController(accountService as any)

    const result = await controller.listAccounts({
      tenantId: 'tenant-1',
    } as any)

    expect(accountService.listAccounts).toHaveBeenCalledWith('tenant-1', {
      includeArchived: false,
    })
    expect(result).toEqual({
      data: {
        accounts: [{ id: 'account-1' }],
      },
    })
  })

  it('includes archived accounts when the query flag is set', async () => {
    const accountService = {
      listAccounts: vi.fn().mockResolvedValue([]),
    }
    const controller = new AccountsController(accountService as any)

    await controller.listAccounts({ tenantId: 'tenant-1' } as any, 'true')

    expect(accountService.listAccounts).toHaveBeenCalledWith('tenant-1', {
      includeArchived: true,
    })
  })

  it('creates an account using the resolved tenant context', async () => {
    const accountService = {
      createAccount: vi.fn().mockResolvedValue({ id: 'account-1' }),
    }
    const controller = new AccountsController(accountService as any)

    const result = await controller.createAccount(
      { tenantId: 'tenant-1' } as any,
      {
        name: 'Cash wallet',
        type: 'cash',
        currency: 'COP',
      },
    )

    expect(accountService.createAccount).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      name: 'Cash wallet',
      type: 'cash',
      currency: 'COP',
    })
    expect(result).toEqual({
      data: {
        account: { id: 'account-1' },
      },
    })
  })

  it('updates an account using the resolved tenant and actor context', async () => {
    const accountService = {
      updateAccount: vi.fn().mockResolvedValue({ id: 'account-1' }),
    }
    const controller = new AccountsController(accountService as any)

    const result = await controller.updateAccount(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'corr-1' } as any,
      'account-1',
      { name: 'Renamed', type: 'savings' },
    )

    expect(accountService.updateAccount).toHaveBeenCalledWith({
      id: 'account-1',
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'corr-1',
      name: 'Renamed',
      type: 'savings',
    })
    expect(result).toEqual({ data: { account: { id: 'account-1' } } })
  })

  it('archives an account using the resolved tenant and actor context', async () => {
    const accountService = {
      archiveAccount: vi.fn().mockResolvedValue({ id: 'account-1' }),
    }
    const controller = new AccountsController(accountService as any)

    const result = await controller.archiveAccount(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'corr-1' } as any,
      'account-1',
    )

    expect(accountService.archiveAccount).toHaveBeenCalledWith({
      id: 'account-1',
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'corr-1',
    })
    expect(result).toEqual({ data: { account: { id: 'account-1' } } })
  })

  it('restores an account using the resolved tenant and actor context', async () => {
    const accountService = {
      restoreAccount: vi.fn().mockResolvedValue({ id: 'account-1' }),
    }
    const controller = new AccountsController(accountService as any)

    const result = await controller.restoreAccount(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'corr-1' } as any,
      'account-1',
    )

    expect(accountService.restoreAccount).toHaveBeenCalledWith({
      id: 'account-1',
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'corr-1',
    })
    expect(result).toEqual({ data: { account: { id: 'account-1' } } })
  })
})
