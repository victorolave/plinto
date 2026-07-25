import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import {
  CreateRecurringRuleStatus,
  RecurringRuleStatus,
  RecurringTransactionExecution,
  RecurringTransactionRule,
} from '../domain/recurring-transaction.entity'
import { TransactionType } from '../../transactions/domain/transaction.entity'
import {
  RecurringExecutionResult,
  RecurringRuleUpdate,
  RecurringTransactionRepository,
} from '../domain/recurring-transaction.repository'

/**
 * Prisma adapter for the RecurringTransactionRepository port. This is the
 * only unit that knows about Prisma for the recurring aggregate; swapping
 * ORMs means adding a sibling adapter and rebinding the port in
 * RecurringModule.
 */
@Injectable()
export class PrismaRecurringTransactionRepository extends RecurringTransactionRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async createRule(data: {
    tenantId: string
    accountId: string
    name: string
    type: TransactionType
    amountMinor: number
    currency: string
    dayOfMonth: number
    startDate: Date
    status: CreateRecurringRuleStatus
  }): Promise<RecurringTransactionRule> {
    return this.prisma.recurringTransactionRule.create({
      data: {
        ...data,
        frequency: 'monthly',
      },
    })
  }

  async listRulesByTenantId(
    tenantId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<RecurringTransactionRule[]> {
    return this.prisma.recurringTransactionRule.findMany({
      where: {
        tenantId,
        // Hide rules whose account has been archived — consistent with archived
        // accounts disappearing from every active surface.
        account: { archivedAt: null },
        ...(options.includeArchived ? {} : { status: { not: 'archived' } }),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findRuleByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<RecurringTransactionRule | null> {
    return this.prisma.recurringTransactionRule.findFirst({
      where: { id, tenantId },
    })
  }

  async updateRuleForTenant(
    id: string,
    tenantId: string,
    data: RecurringRuleUpdate,
  ): Promise<RecurringTransactionRule | null> {
    // updateMany (not update) so the tenant scope is part of the WHERE clause:
    // a cross-tenant id matches zero rows instead of updating someone else's
    // rule. Same convention as PrismaAccountRepository.
    const result = await this.prisma.recurringTransactionRule.updateMany({
      where: { id, tenantId },
      data,
    })

    if (result.count === 0) {
      return null
    }

    return this.findRuleByIdForTenant(id, tenantId)
  }

  async setRuleStatusForTenant(
    id: string,
    tenantId: string,
    status: RecurringRuleStatus,
  ): Promise<RecurringTransactionRule | null> {
    const result = await this.prisma.recurringTransactionRule.updateMany({
      where: { id, tenantId },
      data: { status },
    })

    if (result.count === 0) {
      return null
    }

    return this.findRuleByIdForTenant(id, tenantId)
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
        // Only `active` rules materialize money: `paused` and `archived` are
        // both excluded by this single predicate.
        status: 'active',
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
  }): Promise<RecurringExecutionResult | null> {
    try {
      return await this.runExecutionTransaction(input)
    } catch (error) {
      // A concurrent execution of the same (tenantId, idempotencyKey) — or
      // (ruleId, period) — pair raced past the findExecutionByKey check and
      // landed first. Signal "duplicate" with null (the same convention this
      // codebase uses elsewhere for "not found", e.g. PrismaAccountRepository)
      // instead of letting the raw Prisma error surface as an unhandled 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null
      }

      throw error
    }
  }

  private async runExecutionTransaction(input: {
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
