import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountService } from '../account.service'

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

const makeAccountRepo = () => ({
  create: vi.fn(),
  listByTenantId: vi.fn(),
})

describe('AccountService', () => {
  let accountRepository: ReturnType<typeof makeAccountRepo>
  let service: AccountService

  beforeEach(() => {
    accountRepository = makeAccountRepo()
    service = new AccountService(accountRepository as any)
  })

  describe('createAccount', () => {
    it('creates an account scoped to the active tenant', async () => {
      const account = makeAccount()
      accountRepository.create.mockResolvedValue(account)

      const result = await service.createAccount({
        tenantId: 'tenant-1',
        name: 'Main bank account',
        type: 'bank',
        currency: 'COP',
      })

      expect(accountRepository.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        name: 'Main bank account',
        type: 'bank',
        currency: 'COP',
      })
      expect(result).toBe(account)
    })
  })

  describe('listAccounts', () => {
    it('lists accounts only for the active tenant', async () => {
      const accounts = [makeAccount()]
      accountRepository.listByTenantId.mockResolvedValue(accounts)

      const result = await service.listAccounts('tenant-1')

      expect(accountRepository.listByTenantId).toHaveBeenCalledWith('tenant-1')
      expect(result).toBe(accounts)
    })
  })
})
