import { Injectable } from '@nestjs/common'
import { UserRepository } from '../infrastructure/user.repository'
import { User } from '../domain/user.entity'

@Injectable()
export class UserProvisioningService {
  constructor(private readonly userRepository: UserRepository) {}

  async provisionUser(data: {
    idpSub: string
    email: string
    name?: string | null
  }): Promise<User> {
    const existing = await this.userRepository.findByIdpSub(data.idpSub)
    if (existing) {
      return existing
    }
    return this.userRepository.create(data)
  }
}
