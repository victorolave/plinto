import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { AccountRepository } from '../../accounts/domain/account.repository'
import { AuditService } from '../../audit/application/audit.service'
import { TransactionType } from '../../transactions/domain/transaction.entity'
import {
  CreateRecurringRuleStatus,
  RecurringRuleStatus,
  RecurringTransactionRule,
} from '../domain/recurring-transaction.entity'
import {
  RecurringRuleUpdate,
  RecurringTransactionRepository,
} from '../domain/recurring-transaction.repository'
import { RecurringExecutionService } from './recurring-execution.service'

const RULE_NOT_FOUND = {
  code: 'RECURRING_RULE_NOT_FOUND',
  message: 'Recurring rule not found for the active tenant',
} as const

const RULE_ARCHIVED = {
  code: 'RECURRING_RULE_ARCHIVED',
  message: 'Recurring rule is archived; restore it before changing it',
} as const

/** Actor and correlation data every audited mutation carries. */
interface MutationContext {
  tenantId: string
  actorUserId: string | null
  correlationId: string
}

@Injectable()
export class RecurringTransactionService {
  constructor(
    private readonly recurringRepository: RecurringTransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly recurringExecutionService: RecurringExecutionService,
    private readonly auditService: AuditService,
  ) {}

  async createRule(params: MutationContext & {
    accountId: string
    name: string
    type: TransactionType
    amountMinor: number
    dayOfMonth: number
    startDate: string
    status?: CreateRecurringRuleStatus
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

    const rule = await this.recurringRepository.createRule({
      tenantId: params.tenantId,
      accountId: params.accountId,
      name: params.name,
      type: params.type,
      amountMinor: params.amountMinor,
      currency: account.currency,
      dayOfMonth: params.dayOfMonth,
      startDate: new Date(params.startDate),
      status: params.status ?? 'active',
    })

    await this.audit(params, 'recurring_rule.created', rule, {
      name: rule.name,
      accountId: rule.accountId,
      type: rule.type,
      amountMinor: rule.amountMinor,
      currency: rule.currency,
      dayOfMonth: rule.dayOfMonth,
      status: rule.status,
    })

    return rule
  }

  async listRules(
    tenantId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<RecurringTransactionRule[]> {
    return this.recurringRepository.listRulesByTenantId(tenantId, options)
  }

  async updateRule(params: MutationContext & {
    id: string
    name?: string
    amountMinor?: number
    dayOfMonth?: number
    startDate?: string
  }): Promise<RecurringTransactionRule> {
    const existing = await this.requireRule(params.id, params.tenantId)

    // Editing a retired rule would silently resurrect intent the user already
    // put away. Restore it first, so the revival is an explicit act.
    if (existing.status === 'archived') {
      throw new ConflictException(RULE_ARCHIVED)
    }

    const data: RecurringRuleUpdate = {
      name: params.name,
      amountMinor: params.amountMinor,
      dayOfMonth: params.dayOfMonth,
      startDate: params.startDate ? new Date(params.startDate) : undefined,
    }

    const updated = await this.recurringRepository.updateRuleForTenant(
      params.id,
      params.tenantId,
      data,
    )

    if (!updated) {
      throw new NotFoundException(RULE_NOT_FOUND)
    }

    await this.audit(params, 'recurring_rule.updated', updated, {
      before: {
        name: existing.name,
        amountMinor: existing.amountMinor,
        dayOfMonth: existing.dayOfMonth,
        startDate: existing.startDate,
      },
      after: {
        name: updated.name,
        amountMinor: updated.amountMinor,
        dayOfMonth: updated.dayOfMonth,
        startDate: updated.startDate,
      },
    })

    return updated
  }

  /** Stops the job from posting this rule, reversibly. */
  async pauseRule(params: MutationContext & { id: string }): Promise<RecurringTransactionRule> {
    const existing = await this.requireRule(params.id, params.tenantId)

    if (existing.status === 'archived') {
      throw new ConflictException(RULE_ARCHIVED)
    }

    return this.transition(params, existing, 'paused', 'recurring_rule.paused')
  }

  /**
   * Puts the rule back in the job's hands. Archived rules are rejected rather
   * than revived: allowing resume to skip restore would create a second path
   * out of the archive that never passes through the user's intent to restore.
   */
  async resumeRule(params: MutationContext & { id: string }): Promise<RecurringTransactionRule> {
    const existing = await this.requireRule(params.id, params.tenantId)

    if (existing.status === 'archived') {
      throw new ConflictException(RULE_ARCHIVED)
    }

    return this.transition(params, existing, 'active', 'recurring_rule.resumed')
  }

  /** Soft-delete: the rule is retired but its executions and history remain. */
  async archiveRule(params: MutationContext & { id: string }): Promise<RecurringTransactionRule> {
    const existing = await this.requireRule(params.id, params.tenantId)

    return this.transition(params, existing, 'archived', 'recurring_rule.archived')
  }

  /**
   * Restores to `paused`, never straight to `active`. Restoring means "take
   * this out of the archive so I can look at it", and a rule that came back
   * as active could post money on the next job run without anyone deciding
   * that it should. Resuming stays a separate, deliberate act.
   */
  async restoreRule(params: MutationContext & { id: string }): Promise<RecurringTransactionRule> {
    const existing = await this.requireRule(params.id, params.tenantId)

    // Not archived → idempotent success, as with restoring an active account.
    // Guarding here matters: without it, restoring an already-active rule
    // would fall through to the paused transition and silently switch the job
    // off for a rule the user never asked to stop.
    if (existing.status !== 'archived') {
      return existing
    }

    return this.transition(params, existing, 'paused', 'recurring_rule.restored')
  }

  async executeDue(params: {
    dueDate: Date | string
    jobId?: string
  }): Promise<{ created: number; skipped: number }> {
    return this.recurringExecutionService.executeDue(params)
  }

  private async requireRule(
    id: string,
    tenantId: string,
  ): Promise<RecurringTransactionRule> {
    const rule = await this.recurringRepository.findRuleByIdForTenant(id, tenantId)

    if (!rule) {
      throw new NotFoundException(RULE_NOT_FOUND)
    }

    return rule
  }

  private async transition(
    context: MutationContext,
    existing: RecurringTransactionRule,
    status: RecurringRuleStatus,
    action: string,
    metadata: Record<string, unknown> = {},
  ): Promise<RecurringTransactionRule> {
    // Already in the target state → idempotent success, nothing to record.
    // Same behaviour as archiving an already-archived account.
    if (existing.status === status) {
      return existing
    }

    const updated = await this.recurringRepository.setRuleStatusForTenant(
      existing.id,
      context.tenantId,
      status,
    )

    if (!updated) {
      throw new NotFoundException(RULE_NOT_FOUND)
    }

    await this.audit(context, action, updated, {
      ...metadata,
      name: updated.name,
      before: { status: existing.status },
      after: { status: updated.status },
    })

    return updated
  }

  private async audit(
    context: MutationContext,
    action: string,
    rule: RecurringTransactionRule,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      tenantId: context.tenantId,
      actorUserId: context.actorUserId,
      action,
      resourceType: 'recurring_rule',
      resourceId: rule.id,
      correlationId: context.correlationId,
      metadata,
    })
  }
}
