import { Injectable } from '@nestjs/common'
import { AccountRepository } from '../infrastructure/account.repository'
import { Account, AccountType } from '../domain/account.entity'

@Injectable()
export class AccountService {
  constructor(private readonly accountRepository: AccountRepository) {}

  async createAccount(params: {
    tenantId: string
    name: string
    type: AccountType
    currency: string
  }): Promise<Account> {
    return this.accountRepository.create({
      tenantId: params.tenantId,
      name: params.name,
      type: params.type,
      currency: params.currency,
    })
  }

  async listAccounts(tenantId: string): Promise<Account[]> {
    return this.accountRepository.listByTenantId(tenantId)
  }
}
