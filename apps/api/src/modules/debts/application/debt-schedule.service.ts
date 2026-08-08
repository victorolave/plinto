import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { isLiabilityAccountType } from '@plinto/shared'
import { AccountRepository } from '../../accounts/domain/account.repository'
import { AuditService } from '../../audit/application/audit.service'
import { TransactionService } from '../../transactions/application/transaction.service'
import { DebtSchedule } from '../domain/debt-schedule.entity'
import { DebtScheduleRepository } from '../domain/debt-schedule.repository'

export interface DebtCurrencyTotal {
  currency: string
  scheduledOutstandingMinor: number
  lenderOwedMinor: number
}

export interface DebtScheduleView {
  schedule: DebtSchedule
  paidMinor: number
  outstandingMinor: number
  settled: boolean
}

/**
 * Financed purchases: a fixed plan of installments against a liability account.
 *
 * What the plan owes is never stored. It is the principal minus what the
 * obligations this schedule produced have actually been paid — the same
 * reasoning as PRD-006's derived obligation status. A stored balance can
 * contradict the payments behind it, and nothing in the system would be able to
 * say which of the two to believe.
 */
@Injectable()
export class DebtScheduleService {
  constructor(
    private readonly debtScheduleRepository: DebtScheduleRepository,
    private readonly accountRepository: AccountRepository,
    private readonly auditService: AuditService,
    private readonly transactionService: TransactionService,
  ) {}

  async createSchedule(params: {
    tenantId: string
    actorUserId: string | null
    correlationId: string
    accountId: string
    name: string
    principalMinor: number
    installmentMinor: number
    installmentCount: number
    firstDueDate: string
  }): Promise<DebtScheduleView> {
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

    // A plan pays down something owed. Attaching one to a bank account would
    // produce installments that reduce nothing.
    if (!isLiabilityAccountType(account.type)) {
      throw new UnprocessableEntityException({
        code: 'DEBT_ACCOUNT_NOT_A_LIABILITY',
        message: 'A debt schedule must be attached to a debt or credit account',
      })
    }

    const schedule = await this.debtScheduleRepository.create({
      tenantId: params.tenantId,
      accountId: params.accountId,
      name: params.name,
      principalMinor: params.principalMinor,
      installmentMinor: params.installmentMinor,
      installmentCount: params.installmentCount,
      firstDueDate: new Date(params.firstDueDate),
      // Inherited, never given: the plan repays that account, so it cannot be
      // denominated in anything else.
      currency: account.currency,
    })

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'debt_schedule.created',
      resourceType: 'debt_schedule',
      resourceId: schedule.id,
      correlationId: params.correlationId,
      metadata: {
        accountId: params.accountId,
        principalMinor: params.principalMinor,
        installmentMinor: params.installmentMinor,
        installmentCount: params.installmentCount,
        currency: account.currency,
      },
    })

    return { schedule, paidMinor: 0, outstandingMinor: schedule.principalMinor, settled: false }
  }

  async listSchedules(tenantId: string): Promise<DebtScheduleView[]> {
    const rows = await this.debtScheduleRepository.listWithProgress(tenantId)

    return rows.map(({ schedule, paidMinor, generatedCount }) => ({
      schedule,
      paidMinor,
      // Never negative: overpaying an installment settles the plan, it does not
      // make the lender owe the household.
      outstandingMinor: Math.max(schedule.principalMinor - paidMinor, 0),
      // Every installment has to exist AND be covered. Paying the principal
      // early does not settle a plan whose remaining installments have not been
      // materialized yet — those periods still expect a payment.
      settled:
        generatedCount >= schedule.installmentCount && paidMinor >= schedule.principalMinor,
    }))
  }

  /**
   * What the household owes, per currency.
   *
   * Two figures rather than one, because they measure different things.
   * Remaining installments come from the plans; what the liability accounts
   * carry comes from their balances — loans received, card balances, anything
   * recorded as a movement. Recording a financed purchase does not move its
   * account's balance today, so they do not overlap, but nothing guarantees
   * they never will. Adding them would present a number nobody could defend.
   */
  async summarize(tenantId: string): Promise<DebtCurrencyTotal[]> {
    const [views, balances] = await Promise.all([
      this.listSchedules(tenantId),
      this.transactionService.getBalances(tenantId),
    ])

    const byCurrency = new Map<string, DebtCurrencyTotal>()
    const bucketFor = (currency: string): DebtCurrencyTotal => {
      const existing = byCurrency.get(currency)
      if (existing) return existing

      const created = { currency, scheduledOutstandingMinor: 0, lenderOwedMinor: 0 }
      byCurrency.set(currency, created)
      return created
    }

    for (const view of views) {
      // A cancelled plan stops producing installments, so what it had left is
      // no longer owed under it.
      if (view.schedule.status !== 'active') continue

      bucketFor(view.schedule.currency).scheduledOutstandingMinor += view.outstandingMinor
    }

    for (const balance of balances) {
      if (!isLiabilityAccountType(balance.accountType)) continue

      // Liabilities carry a negative balance, so what is owed is its magnitude.
      // A positive one means the account is ahead rather than owed, and adding
      // it would report a debt the household does not have.
      bucketFor(balance.currency).lenderOwedMinor += Math.max(-balance.balanceMinor, 0)
    }

    return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency))
  }

  async rename(params: {
    tenantId: string
    actorUserId: string | null
    correlationId: string
    id: string
    name: string
  }): Promise<DebtSchedule> {
    const schedule = await this.debtScheduleRepository.rename(
      params.id,
      params.tenantId,
      params.name,
    )

    if (!schedule) {
      throw new NotFoundException({
        code: 'DEBT_SCHEDULE_NOT_FOUND',
        message: 'Debt schedule not found for the active tenant',
      })
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'debt_schedule.renamed',
      resourceType: 'debt_schedule',
      resourceId: schedule.id,
      correlationId: params.correlationId,
      metadata: { name: params.name },
    })

    return schedule
  }

  /**
   * Cancels a plan: it stops producing installments from here on.
   *
   * Cancelled, never deleted. The obligations it already produced are real —
   * some of them paid — and deleting the plan behind them would leave a
   * household looking at payments whose reason had vanished.
   */
  async cancel(params: {
    tenantId: string
    actorUserId: string | null
    correlationId: string
    id: string
  }): Promise<DebtSchedule> {
    const schedule = await this.debtScheduleRepository.setStatus(
      params.id,
      params.tenantId,
      'cancelled',
    )

    if (!schedule) {
      throw new NotFoundException({
        code: 'DEBT_SCHEDULE_NOT_FOUND',
        message: 'Debt schedule not found for the active tenant',
      })
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'debt_schedule.cancelled',
      resourceType: 'debt_schedule',
      resourceId: schedule.id,
      correlationId: params.correlationId,
    })

    return schedule
  }
}
