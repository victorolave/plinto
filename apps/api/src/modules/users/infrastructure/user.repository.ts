import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { User } from '../domain/user.entity'

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

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
