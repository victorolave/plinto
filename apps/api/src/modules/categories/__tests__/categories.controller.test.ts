import 'reflect-metadata'
import { describe, it, expect, vi } from 'vitest'
import { Reflector } from '@nestjs/core'
import { PERMISSION_KEY } from '../../../common/guards/role.guard'
import { CategoriesController } from '../interfaces/http/v1/categories.controller'

describe('CategoriesController — permission metadata', () => {
  it('requires category:read to list categories', () => {
    const reflector = new Reflector()
    const permission = reflector.get(PERMISSION_KEY, CategoriesController.prototype.listCategories)
    expect(permission).toBe('category:read')
  })

  it('requires category:read to get a single category', () => {
    const reflector = new Reflector()
    const permission = reflector.get(PERMISSION_KEY, CategoriesController.prototype.getCategory)
    expect(permission).toBe('category:read')
  })

  it('requires category:write to create a category', () => {
    const reflector = new Reflector()
    const permission = reflector.get(PERMISSION_KEY, CategoriesController.prototype.createCategory)
    expect(permission).toBe('category:write')
  })

  it('requires category:write to update a category', () => {
    const reflector = new Reflector()
    const permission = reflector.get(PERMISSION_KEY, CategoriesController.prototype.updateCategory)
    expect(permission).toBe('category:write')
  })

  it('requires category:write to delete a category', () => {
    const reflector = new Reflector()
    const permission = reflector.get(PERMISSION_KEY, CategoriesController.prototype.deleteCategory)
    expect(permission).toBe('category:write')
  })
})

describe('CategoriesController — route behavior', () => {
  const makeCategory = (overrides = {}) => ({
    id: 'cat-1',
    tenantId: 'tenant-1',
    name: 'Food',
    type: 'expense' as const,
    color: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  const makeService = () => ({
    listCategories: vi.fn(),
    findByIdForTenant: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
  })

  it('listCategories returns { data: { categories } }', async () => {
    const svc = makeService()
    const categories = [makeCategory()]
    svc.listCategories.mockResolvedValue(categories)
    const controller = new CategoriesController(svc as any)

    const result = await controller.listCategories({ tenantId: 'tenant-1' } as any)

    expect(result).toEqual({ data: { categories } })
  })

  it('getCategory returns { data: { category } }', async () => {
    const svc = makeService()
    const cat = makeCategory()
    svc.findByIdForTenant.mockResolvedValue(cat)
    const controller = new CategoriesController(svc as any)

    const result = await controller.getCategory({ tenantId: 'tenant-1' } as any, 'cat-1')

    expect(svc.findByIdForTenant).toHaveBeenCalledWith('cat-1', 'tenant-1')
    expect(result).toEqual({ data: { category: cat } })
  })

  it('createCategory returns { data: { category } }', async () => {
    const svc = makeService()
    const cat = makeCategory()
    svc.createCategory.mockResolvedValue(cat)
    const controller = new CategoriesController(svc as any)

    const result = await controller.createCategory(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as any,
      { name: 'Food', type: 'expense' },
    )

    expect(result).toEqual({ data: { category: cat } })
  })

  it('deleteCategory returns { data: { deleted: true } }', async () => {
    const svc = makeService()
    svc.deleteCategory.mockResolvedValue(undefined)
    const controller = new CategoriesController(svc as any)

    const result = await controller.deleteCategory(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as any,
      'cat-1',
    )

    expect(result).toEqual({ data: { deleted: true } })
  })
})
