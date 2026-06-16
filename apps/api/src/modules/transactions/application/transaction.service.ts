import { Injectable, NotFoundException } from '@nestjs/common'
import { TransactionRepository } from '../infrastructure/transaction.repository'
import { AccountRepository } from '../../accounts/infrastructure/account.repository'
import { AuditService } from '../../audit/application/audit.service'
import { Transaction, TransactionType, AccountBalance } from '../domain/transaction.entity'

@Injectable()
export class TransactionService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly auditService: AuditService,
  ) {}

  async createTransaction(params: {
    tenantId: string
    actorUserId: string | null
    requestId: string
    accountId: string
    type: TransactionType
    amountMinor: number
    description?: string
    occurredAt?: string
  }): Promise<Transaction> {
    const account = await this.accountRepository.findByIdForTenant(
      params.accountId,
      params.tenantId,
    )

    if (!account) {
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found for the active tenant',
      })
    }

    const transaction = await this.transactionRepository.create({
      tenantId: params.tenantId,
      accountId: params.accountId,
      type: params.type,
      amountMinor: params.amountMinor,
      currency: account.currency,
      description: params.description ?? null,
      occurredAt: params.occurredAt ? new Date(params.occurredAt) : new Date(),
    })

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: `transaction.${params.type}`,
      resourceType: 'transaction',
      resourceId: transaction.id,
      correlationId: params.requestId,
      metadata: {
        accountId: params.accountId,
        amountMinor: params.amountMinor,
        currency: account.currency,
      },
    })

    return transaction
  }

  async listTransactions(tenantId: string, accountId?: string): Promise<Transaction[]> {
    if (accountId) {
      return this.transactionRepository.listByAccountId(tenantId, accountId)
    }
    return this.transactionRepository.listByTenantId(tenantId)
  }

  async getBalances(tenantId: string): Promise<AccountBalance[]> {
    const [accounts, transactions] = await Promise.all([
      this.accountRepository.listByTenantId(tenantId),
      this.transactionRepository.listByTenantId(tenantId),
    ])

    return accounts.map((account) => {
      const accountTransactions = transactions.filter(
        (t) => t.accountId === account.id,
      )
      const balanceMinor = accountTransactions.reduce((sum, t) => {
        if (t.type === 'income') return sum + t.amountMinor
        return sum - t.amountMinor
      }, 0)

      return {
        accountId: account.id,
        accountName: account.name,
        currency: account.currency,
        balanceMinor,
      }
    })
  }
}
