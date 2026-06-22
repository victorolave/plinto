import { Injectable, NotFoundException } from '@nestjs/common'
import { AccountRepository } from '../../accounts/infrastructure/account.repository'
import { TransactionType } from '../../transactions/domain/transaction.entity'
import { RecurringTransactionRule } from '../domain/recurring-transaction.entity'
import { RecurringTransactionRepository } from '../infrastructure/recurring-transaction.repository'
import { RecurringExecutionService } from './recurring-execution.service'

@Injectable()
export class RecurringTransactionService {
  constructor(
    private readonly recurringRepository: RecurringTransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly recurringExecutionService: RecurringExecutionService,
  ) {}

  async createRule(params: {
    tenantId: string
    accountId: string
    name: string
    type: TransactionType
    amountMinor: number
    dayOfMonth: number
    startDate: string
    active?: boolean
  }): Promise<RecurringTransactionRule> {
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

    return this.recurringRepository.createRule({
      tenantId: params.tenantId,
      accountId: params.accountId,
      name: params.name,
      type: params.type,
      amountMinor: params.amountMinor,
      currency: account.currency,
      dayOfMonth: params.dayOfMonth,
      startDate: new Date(params.startDate),
      active: params.active ?? true,
    })
  }

  async listRules(tenantId: string): Promise<RecurringTransactionRule[]> {
    return this.recurringRepository.listRulesByTenantId(tenantId)
  }

  async executeDue(params: {
    dueDate: Date | string
    jobId?: string
  }): Promise<{ created: number; skipped: number }> {
    return this.recurringExecutionService.executeDue(params)
  }
}
