import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { AccountService } from '../account.service'

const makeAccount = (overrides = {}) => ({
  id: 'account-1',
  tenantId: 'tenant-1',
  name: 'Main bank account',
  type: 'bank' as const,
  currency: 'COP',
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null as Date | null,
  ...overrides,
})

const makeAccountRepo = () => ({
  create: vi.fn(),
  listByTenantId: vi.fn(),
  findByIdForTenant: vi.fn(),
  updateForTenant: vi.fn(),
  archiveForTenant: vi.fn(),
  restoreForTenant: vi.fn(),
})

const makeAuditService = () => ({
  record: vi.fn().mockResolvedValue(undefined),
})

describe('AccountService', () => {
  let accountRepository: ReturnType<typeof makeAccountRepo>
  let auditService: ReturnType<typeof makeAuditService>
  let service: AccountService

  beforeEach(() => {
    accountRepository = makeAccountRepo()
    auditService = makeAuditService()
    service = new AccountService(accountRepository as any, auditService as any)
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
    it('lists active accounts only for the active tenant by default', async () => {
      const accounts = [makeAccount()]
      accountRepository.listByTenantId.mockResolvedValue(accounts)

      const result = await service.listAccounts('tenant-1')

      expect(accountRepository.listByTenantId).toHaveBeenCalledWith('tenant-1', {})
      expect(result).toBe(accounts)
    })

    it('forwards the includeArchived option', async () => {
      accountRepository.listByTenantId.mockResolvedValue([])

      await service.listAccounts('tenant-1', { includeArchived: true })

      expect(accountRepository.listByTenantId).toHaveBeenCalledWith('tenant-1', {
        includeArchived: true,
      })
    })
  })

  describe('updateAccount', () => {
    it('updates the account and records an audit event', async () => {
      const existing = makeAccount({ name: 'Old', type: 'cash' })
      const updated = makeAccount({ name: 'New', type: 'bank' })
      accountRepository.findByIdForTenant.mockResolvedValue(existing)
      accountRepository.updateForTenant.mockResolvedValue(updated)

      const result = await service.updateAccount({
        id: 'account-1',
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'corr-1',
        name: 'New',
        type: 'bank',
      })

      expect(accountRepository.updateForTenant).toHaveBeenCalledWith(
        'account-1',
        'tenant-1',
        { name: 'New', type: 'bank' },
      )
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'account.updated' }),
      )
      expect(result).toBe(updated)
    })

    it('throws when the account does not exist for the tenant', async () => {
      accountRepository.findByIdForTenant.mockResolvedValue(null)

      await expect(
        service.updateAccount({
          id: 'missing',
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'corr-1',
          name: 'New',
        }),
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(accountRepository.updateForTenant).not.toHaveBeenCalled()
    })
  })

  describe('archiveAccount', () => {
    it('archives an active account and records an audit event', async () => {
      const existing = makeAccount({ archivedAt: null })
      const archived = makeAccount({ archivedAt: new Date() })
      accountRepository.findByIdForTenant.mockResolvedValue(existing)
      accountRepository.archiveForTenant.mockResolvedValue(archived)

      const result = await service.archiveAccount({
        id: 'account-1',
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'corr-1',
      })

      expect(accountRepository.archiveForTenant).toHaveBeenCalled()
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'account.archived' }),
      )
      expect(result).toBe(archived)
    })

    it('is idempotent when the account is already archived', async () => {
      const existing = makeAccount({ archivedAt: new Date() })
      accountRepository.findByIdForTenant.mockResolvedValue(existing)

      const result = await service.archiveAccount({
        id: 'account-1',
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'corr-1',
      })

      expect(accountRepository.archiveForTenant).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
      expect(result).toBe(existing)
    })
  })

  describe('restoreAccount', () => {
    it('restores an archived account and records an audit event', async () => {
      const existing = makeAccount({ archivedAt: new Date() })
      const restored = makeAccount({ archivedAt: null })
      accountRepository.findByIdForTenant.mockResolvedValue(existing)
      accountRepository.restoreForTenant.mockResolvedValue(restored)

      const result = await service.restoreAccount({
        id: 'account-1',
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'corr-1',
      })

      expect(accountRepository.restoreForTenant).toHaveBeenCalledWith(
        'account-1',
        'tenant-1',
      )
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'account.restored' }),
      )
      expect(result).toBe(restored)
    })

    it('is idempotent when the account is already active', async () => {
      const existing = makeAccount({ archivedAt: null })
      accountRepository.findByIdForTenant.mockResolvedValue(existing)

      const result = await service.restoreAccount({
        id: 'account-1',
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'corr-1',
      })

      expect(accountRepository.restoreForTenant).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
      expect(result).toBe(existing)
    })
  })
})
