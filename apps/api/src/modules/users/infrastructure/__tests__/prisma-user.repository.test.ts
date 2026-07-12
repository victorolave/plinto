import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaUserRepository } from '../prisma-user.repository'
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service'

const makePrisma = () => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
})

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  idpSub: 'idp|abc123',
  email: 'user@example.com',
  name: 'Jane Doe',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('PrismaUserRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repository: PrismaUserRepository

  beforeEach(() => {
    prisma = makePrisma()
    repository = new PrismaUserRepository(prisma as unknown as PrismaService)
  })

  describe('findById', () => {
    it('looks up the user by id', async () => {
      const user = makeUser()
      prisma.user.findUnique.mockResolvedValue(user)

      const result = await repository.findById('user-1')

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } })
      expect(result).toBe(user)
    })

    it('returns null when no user matches the id', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      const result = await repository.findById('missing-user')

      expect(result).toBeNull()
    })
  })

  describe('findByIdpSub', () => {
    it('looks up the user by identity provider subject', async () => {
      const user = makeUser()
      prisma.user.findUnique.mockResolvedValue(user)

      const result = await repository.findByIdpSub('idp|abc123')

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { idpSub: 'idp|abc123' } })
      expect(result).toBe(user)
    })

    it('returns null when no user matches the idpSub', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      const result = await repository.findByIdpSub('idp|unknown')

      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('creates the user with idpSub, email, and name', async () => {
      const user = makeUser()
      prisma.user.create.mockResolvedValue(user)

      const result = await repository.create({
        idpSub: 'idp|abc123',
        email: 'user@example.com',
        name: 'Jane Doe',
      })

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { idpSub: 'idp|abc123', email: 'user@example.com', name: 'Jane Doe' },
      })
      expect(result).toBe(user)
    })

    it('passes a null name through unchanged', async () => {
      const user = makeUser({ name: null })
      prisma.user.create.mockResolvedValue(user)

      await repository.create({
        idpSub: 'idp|abc123',
        email: 'user@example.com',
        name: null,
      })

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { idpSub: 'idp|abc123', email: 'user@example.com', name: null },
      })
    })
  })

  describe('updateName', () => {
    it('updates the name of the user matched by id', async () => {
      const user = makeUser({ name: 'New Name' })
      prisma.user.update.mockResolvedValue(user)

      const result = await repository.updateName('user-1', 'New Name')

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'New Name' },
      })
      expect(result).toBe(user)
    })
  })
})
