import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { User } from '../domain/user.entity'
import { UserRepository } from '../domain/user.repository'

/**
 * Prisma adapter for the UserRepository port. This is the only unit that
 * knows about Prisma for the users aggregate; swapping ORMs means adding a
 * sibling adapter and rebinding the port in UsersModule.
 */
@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async findByIdpSub(idpSub: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { idpSub } })
  }

  async create(data: {
    idpSub: string
    email: string
    name?: string | null
  }): Promise<User> {
    return this.prisma.user.create({ data })
  }

  async updateName(id: string, name: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { name } })
  }
}
