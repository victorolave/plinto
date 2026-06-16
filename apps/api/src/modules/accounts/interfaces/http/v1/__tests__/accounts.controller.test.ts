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

  it('lists accounts using the resolved tenant context', async () => {
    const accountService = {
      listAccounts: vi.fn().mockResolvedValue([{ id: 'account-1' }]),
    }
    const controller = new AccountsController(accountService as any)

    const result = await controller.listAccounts({
      tenantId: 'tenant-1',
    } as any)

    expect(accountService.listAccounts).toHaveBeenCalledWith('tenant-1')
    expect(result).toEqual({
      data: {
        accounts: [{ id: 'account-1' }],
      },
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
})
