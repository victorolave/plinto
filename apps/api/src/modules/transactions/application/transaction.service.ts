import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
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

  async createTransfer(params: {
    tenantId: string
    actorUserId: string | null
    correlationId: string
    sourceAccountId: string
    destinationAccountId: string
    amountMinor: number
    description?: string
    occurredAt?: string
  }): Promise<{ transferId: string; debit: Transaction; credit: Transaction }> {
    if (params.sourceAccountId === params.destinationAccountId) {
      throw new UnprocessableEntityException({
        code: 'TRANSFER_SAME_ACCOUNT',
        message: 'Source and destination accounts must differ',
      })
    }

    const [sourceAccount, destinationAccount] = await Promise.all([
      this.accountRepository.findByIdForTenant(params.sourceAccountId, params.tenantId),
      this.accountRepository.findByIdForTenant(params.destinationAccountId, params.tenantId),
    ])

    if (!sourceAccount) {
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found for the active tenant',
      })
    }

    if (!destinationAccount) {
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found for the active tenant',
      })
    }

    if (sourceAccount.currency !== destinationAccount.currency) {
      throw new UnprocessableEntityException({
        code: 'TRANSFER_CURRENCY_MISMATCH',
        message: 'Source and destination accounts must share the same currency',
      })
    }

    const transferId = crypto.randomUUID()
    const currency = sourceAccount.currency
    const occurredAt = params.occurredAt ? new Date(params.occurredAt) : new Date()
    const description = params.description ?? null

    const { debit, credit } = await this.transactionRepository.createTransferPair(
      {
        tenantId: params.tenantId,
        accountId: params.sourceAccountId,
        amountMinor: params.amountMinor,
        currency,
        description,
        occurredAt,
        transferId,
      },
      {
        tenantId: params.tenantId,
        accountId: params.destinationAccountId,
        amountMinor: params.amountMinor,
        currency,
        description,
        occurredAt,
        transferId,
      },
    )

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'transaction.transfer',
      resourceType: 'transaction',
      resourceId: debit.id,
      correlationId: params.correlationId,
      metadata: {
        transferId,
        direction: 'debit',
        fromAccountId: params.sourceAccountId,
        toAccountId: params.destinationAccountId,
        amountMinor: params.amountMinor,
        currency,
      },
    })

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'transaction.transfer',
      resourceType: 'transaction',
      resourceId: credit.id,
      correlationId: params.correlationId,
      metadata: {
        transferId,
        direction: 'credit',
        fromAccountId: params.sourceAccountId,
        toAccountId: params.destinationAccountId,
        amountMinor: params.amountMinor,
        currency,
      },
    })

    return { transferId, debit, credit }
  }

  async updateTransaction(params: {
    tenantId: string
    actorUserId: string | null
    requestId: string
    transactionId: string
    accountId?: string
    type?: TransactionType
    amountMinor?: number
    description?: string | null
    occurredAt?: string
  }): Promise<Transaction> {
    const existing = await this.transactionRepository.findByIdForTenant(
      params.transactionId,
      params.tenantId,
    )

    if (!existing) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found for the active tenant',
      })
    }

    let currency = existing.currency
    if (params.accountId) {
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

      currency = account.currency
    }

    const updated = await this.transactionRepository.updateForTenant(
      params.transactionId,
      params.tenantId,
      {
        accountId: params.accountId,
        type: params.type,
        amountMinor: params.amountMinor,
        currency: params.accountId ? currency : undefined,
        description:
          params.description === undefined ? undefined : params.description,
        occurredAt: params.occurredAt ? new Date(params.occurredAt) : undefined,
      },
    )

    if (!updated) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found for the active tenant',
      })
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'transaction.updated',
      resourceType: 'transaction',
      resourceId: updated.id,
      correlationId: params.requestId,
      metadata: {
        before: {
          accountId: existing.accountId,
          type: existing.type,
          amountMinor: existing.amountMinor,
          currency: existing.currency,
          description: existing.description,
          occurredAt: existing.occurredAt.toISOString(),
        },
        after: {
          accountId: updated.accountId,
          type: updated.type,
          amountMinor: updated.amountMinor,
          currency: updated.currency,
          description: updated.description,
          occurredAt: updated.occurredAt.toISOString(),
        },
      },
    })

    return updated
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
