import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import {
  RecurringTransactionExecution,
  RecurringTransactionRule,
} from '../domain/recurring-transaction.entity'
import { Transaction, TransactionType } from '../../transactions/domain/transaction.entity'

export interface RecurringExecutionResult {
  transaction: Transaction
  execution: RecurringTransactionExecution
}

@Injectable()
export class RecurringTransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRule(data: {
    tenantId: string
    accountId: string
    name: string
    type: TransactionType
    amountMinor: number
    currency: string
    dayOfMonth: number
    startDate: Date
    active: boolean
  }): Promise<RecurringTransactionRule> {
    return this.prisma.recurringTransactionRule.create({
      data: {
        ...data,
        frequency: 'monthly',
      },
    })
  }

  async listRulesByTenantId(tenantId: string): Promise<RecurringTransactionRule[]> {
    return this.prisma.recurringTransactionRule.findMany({
      // Hide rules whose account has been archived — consistent with archived
      // accounts disappearing from every active surface.
      where: { tenantId, account: { archivedAt: null } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findExecutionByKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<RecurringTransactionExecution | null> {
    return this.prisma.recurringTransactionExecution.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId, idempotencyKey },
      },
    })
  }

  async listActiveMonthlyRulesDueBy(dueDate: Date): Promise<RecurringTransactionRule[]> {
    const rules = await this.prisma.recurringTransactionRule.findMany({
      where: {
        active: true,
        frequency: 'monthly',
        startDate: { lte: dueDate },
        // Never auto-post into an archived account: its rules stay dormant until
        // (and unless) the account is restored.
        account: { archivedAt: null },
      },
      orderBy: { createdAt: 'asc' },
    })

    return rules.filter((rule) => {
      const scheduledAt = toUtcOccurrenceDate(dueDate, rule.dayOfMonth)

      return scheduledAt <= dueDate && scheduledAt >= rule.startDate
    })
  }

  async createExecutionTransaction(input: {
    rule: RecurringTransactionRule
    period: string
    idempotencyKey: string
    occurredAt: Date
    jobId?: string
  }): Promise<RecurringExecutionResult> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          tenantId: input.rule.tenantId,
          accountId: input.rule.accountId,
          type: input.rule.type,
          amountMinor: input.rule.amountMinor,
          currency: input.rule.currency,
          description: input.rule.name,
          occurredAt: input.occurredAt,
          source: 'job',
          recurringRuleId: input.rule.id,
          recurringPeriod: input.period,
          idempotencyKey: input.idempotencyKey,
        },
      })

      const execution = await tx.recurringTransactionExecution.create({
        data: {
          tenantId: input.rule.tenantId,
          ruleId: input.rule.id,
          period: input.period,
          idempotencyKey: input.idempotencyKey,
          transactionId: transaction.id,
          status: 'success',
          jobId: input.jobId ?? null,
        },
      })

      await tx.auditEvent.create({
        data: {
          tenantId: input.rule.tenantId,
          actorUserId: null,
          action: `transaction.${input.rule.type}`,
          resourceType: 'transaction',
          resourceId: transaction.id,
          source: 'job',
          correlationId: input.jobId ?? input.idempotencyKey,
          metadata: {
            recurringRuleId: input.rule.id,
            recurringPeriod: input.period,
            idempotencyKey: input.idempotencyKey,
            accountId: input.rule.accountId,
            amountMinor: input.rule.amountMinor,
            currency: input.rule.currency,
          },
        },
      })

      return { transaction, execution }
    })
  }
}

function toUtcOccurrenceDate(dueDate: Date, dayOfMonth: number): Date {
  return new Date(Date.UTC(
    dueDate.getUTCFullYear(),
    dueDate.getUTCMonth(),
    dayOfMonth,
  ))
}
