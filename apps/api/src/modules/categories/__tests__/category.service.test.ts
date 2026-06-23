import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { CategoryService } from '../application/category.service'

const makeCategory = (overrides = {}) => ({
  id: 'cat-1',
  tenantId: 'tenant-1',
  name: 'Food',
  type: 'expense' as const,
  color: '#FF0000',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeCategoryRepo = () => ({
  create: vi.fn(),
  listByTenantId: vi.fn(),
  findByIdForTenant: vi.fn(),
  updateForTenant: vi.fn(),
  deleteForTenant: vi.fn(),
})

const makeAuditService = () => ({
  record: vi.fn(),
})

describe('CategoryService', () => {
  let categoryRepository: ReturnType<typeof makeCategoryRepo>
  let auditService: ReturnType<typeof makeAuditService>
  let service: CategoryService

  beforeEach(() => {
    categoryRepository = makeCategoryRepo()
    auditService = makeAuditService()
    service = new CategoryService(categoryRepository as any, auditService as any)
  })

  describe('createCategory', () => {
    it('creates a category and emits audit event category.created', async () => {
      const cat = makeCategory()
      categoryRepository.create.mockResolvedValue(cat)
      auditService.record.mockResolvedValue(undefined)

      const result = await service.createCategory({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
        name: 'Food',
        type: 'expense',
      })

      expect(categoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', name: 'Food', type: 'expense' }),
      )
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'category.created', resourceType: 'category', resourceId: cat.id }),
      )
      expect(result).toBe(cat)
    })
  })

  describe('listCategories', () => {
    it('delegates to repository listByTenantId', async () => {
      const categories = [makeCategory()]
      categoryRepository.listByTenantId.mockResolvedValue(categories)

      const result = await service.listCategories('tenant-1')

      expect(categoryRepository.listByTenantId).toHaveBeenCalledWith('tenant-1')
      expect(result).toBe(categories)
    })
  })

  describe('findByIdForTenant', () => {
    it('returns the category when found', async () => {
      const cat = makeCategory()
      categoryRepository.findByIdForTenant.mockResolvedValue(cat)

      const result = await service.findByIdForTenant('cat-1', 'tenant-1')

      expect(result).toBe(cat)
    })

    it('throws NotFoundException with code CATEGORY_NOT_FOUND when category is null', async () => {
      categoryRepository.findByIdForTenant.mockResolvedValue(null)

      await expect(service.findByIdForTenant('cat-999', 'tenant-1')).rejects.toThrow(NotFoundException)
      await expect(service.findByIdForTenant('cat-999', 'tenant-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CATEGORY_NOT_FOUND' }),
      })
    })
  })

  describe('updateCategory', () => {
    it('updates and emits audit event category.updated', async () => {
      const existing = makeCategory()
      const updated = makeCategory({ name: 'Groceries' })
      categoryRepository.findByIdForTenant.mockResolvedValue(existing)
      categoryRepository.updateForTenant.mockResolvedValue(updated)
      auditService.record.mockResolvedValue(undefined)

      const result = await service.updateCategory({
        id: 'cat-1',
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
        name: 'Groceries',
      })

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'category.updated', resourceType: 'category', resourceId: 'cat-1' }),
      )
      expect(result).toBe(updated)
    })

    it('throws NotFoundException when category not found for tenant', async () => {
      categoryRepository.findByIdForTenant.mockResolvedValue(null)

      await expect(
        service.updateCategory({
          id: 'cat-999',
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          name: 'Whatever',
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('deleteCategory', () => {
    it('deletes the category without emitting an audit event', async () => {
      categoryRepository.findByIdForTenant.mockResolvedValue(makeCategory())
      categoryRepository.deleteForTenant.mockResolvedValue(1)

      await service.deleteCategory({
        id: 'cat-1',
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
      })

      expect(categoryRepository.deleteForTenant).toHaveBeenCalledWith('cat-1', 'tenant-1')
      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when category not found', async () => {
      categoryRepository.findByIdForTenant.mockResolvedValue(null)

      await expect(
        service.deleteCategory({
          id: 'cat-999',
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
        }),
      ).rejects.toThrow(NotFoundException)

      expect(categoryRepository.deleteForTenant).not.toHaveBeenCalled()
    })
  })
})
