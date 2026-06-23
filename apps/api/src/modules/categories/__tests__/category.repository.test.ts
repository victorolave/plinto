import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CategoryRepository } from '../infrastructure/category.repository'

const makePrisma = () => ({
  category: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: any) => Promise<any>) =>
    fn({
      category: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
    }),
  ),
})

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

describe('CategoryRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repository: CategoryRepository

  beforeEach(() => {
    prisma = makePrisma()
    repository = new CategoryRepository(prisma as any)
  })

  describe('listByTenantId', () => {
    it('returns only categories belonging to the given tenant', async () => {
      const tenantACategories = [makeCategory({ tenantId: 'tenant-a' })]
      prisma.category.findMany.mockResolvedValue(tenantACategories)

      const result = await repository.listByTenantId('tenant-a')

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-a' } }),
      )
      expect(result).toBe(tenantACategories)
    })

    it('does not return categories from another tenant', async () => {
      prisma.category.findMany.mockResolvedValue([])

      const result = await repository.listByTenantId('tenant-b')

      expect(result).toEqual([])
    })
  })

  describe('findByIdForTenant', () => {
    it('returns the category when id and tenantId match', async () => {
      const cat = makeCategory()
      prisma.category.findFirst.mockResolvedValue(cat)

      const result = await repository.findByIdForTenant('cat-1', 'tenant-1')

      expect(prisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cat-1', tenantId: 'tenant-1' } }),
      )
      expect(result).toBe(cat)
    })

    it('returns null when the category belongs to a different tenant', async () => {
      prisma.category.findFirst.mockResolvedValue(null)

      const result = await repository.findByIdForTenant('cat-1', 'wrong-tenant')

      expect(result).toBeNull()
    })
  })

  describe('deleteForTenant', () => {
    it('deletes only the matching category and relies on DB SET NULL for transactions', async () => {
      prisma.category.deleteMany.mockResolvedValue({ count: 1 })

      const count = await repository.deleteForTenant('cat-1', 'tenant-1')

      expect(prisma.category.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cat-1', tenantId: 'tenant-1' } }),
      )
      expect(count).toBe(1)
    })

    it('returns 0 when no category was found for deletion', async () => {
      prisma.category.deleteMany.mockResolvedValue({ count: 0 })

      const count = await repository.deleteForTenant('cat-999', 'tenant-1')

      expect(count).toBe(0)
    })
  })

  describe('updateForTenant', () => {
    it('returns null when tenantId does not match', async () => {
      // updateMany returns count 0 for wrong tenant
      const txMock = {
        category: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn(),
        },
      }
      prisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn(txMock))

      const result = await repository.updateForTenant('cat-1', 'wrong-tenant', { name: 'New' })

      expect(result).toBeNull()
      expect(txMock.category.findFirst).not.toHaveBeenCalled()
    })
  })
})
