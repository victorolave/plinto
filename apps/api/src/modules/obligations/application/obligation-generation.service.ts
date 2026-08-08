import { Injectable } from '@nestjs/common'
import { monthsBetween, occurrenceDate, periodRange, toPeriod } from '../../../common/period'
import { RecurringTransactionRule } from '../../recurring/domain/recurring-transaction.entity'
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository'
import { ObligationRepository } from '../domain/obligation.repository'
import { DebtScheduleRepository } from '../../debts/domain/debt-schedule.repository'
import {
  installmentAmountMinor,
  installmentDayOfMonth,
  installmentIndexFor,
  installmentLabel,
} from '../../debts/domain/debt-schedule.entity'

export interface GenerateObligationsResult {
  created: number
  skipped: number
  periods: string[]
}

/**
 * Materializes the obligations a period is expected to hold, from the active
 * recurring rules across every tenant. Runs as a system operation (ADR 0006),
 * invoked by the same scheduler that drives recurring execution.
 *
 * Generation is idempotent by (rule, period): re-running a period never
 * duplicates an obligation. It is also safe to run ahead of time — generating
 * future periods is what produces the spreadsheet's forward projection.
 */
@Injectable()
export class ObligationGenerationService {
  constructor(
    private readonly obligationRepository: ObligationRepository,
    private readonly recurringRepository: RecurringTransactionRepository,
    private readonly debtScheduleRepository: DebtScheduleRepository,
  ) {}

  async generate(params: {
    period?: string
    horizonMonths?: number
    now?: Date
  }): Promise<GenerateObligationsResult> {
    const startPeriod = params.period ?? toPeriod(params.now ?? new Date())
    const periods = periodRange(startPeriod, params.horizonMonths ?? 1)

    let created = 0
    let skipped = 0

    for (const period of periods) {
      const fromRules = await this.generatePeriod(period)
      // One scheduler call materializes both kinds (PRD-007). A household does
      // not think of rent and a fridge instalment as different machinery, and
      // the board they both land on does not either.
      const fromSchedules = await this.generateSchedulePeriod(period)

      created += fromRules.created + fromSchedules.created
      skipped += fromRules.skipped + fromSchedules.skipped
    }

    return { created, skipped, periods }
  }

  private async generatePeriod(
    period: string,
  ): Promise<{ created: number; skipped: number }> {
    // Paused and archived rules are excluded by the repository's single
    // `status: 'active'` predicate — the invariant the lifecycle enum bought —
    // and income rules by its `type: 'expense'` one.
    const rules =
      await this.recurringRepository.listActiveMonthlyExpenseRulesForPeriod(period)
    let created = 0
    let skipped = 0

    // One "already generated" lookup per tenant rather than per rule: the
    // unique index still guarantees correctness, this only avoids paying for a
    // failed insert on every re-run of an already-materialized period.
    for (const [tenantId, tenantRules] of groupByTenant(rules)) {
      const alreadyGenerated = new Set(
        await this.obligationRepository.listGeneratedRuleIdsForPeriod(tenantId, period),
      )

      for (const rule of tenantRules) {
        if (alreadyGenerated.has(rule.id)) {
          skipped += 1
          continue
        }

        const instance = await this.obligationRepository.createGeneratedInstance({
          tenantId: rule.tenantId,
          sourceType: 'recurring_rule',
          recurringRuleId: rule.id,
          period,
          dueDate: occurrenceDate(period, rule.dayOfMonth),
          name: rule.name,
          // A snapshot, deliberately: editing the rule later must not rewrite
          // what a period was already told to expect.
          expectedAmountMinor: rule.amountMinor,
          currency: rule.currency,
        })

        // null means a concurrent run created this (rule, period) between the
        // lookup above and this insert. Treat it exactly like the
        // already-generated branch: skipped, not created, never an error.
        if (instance === null) {
          skipped += 1
          continue
        }

        created += 1
      }
    }

    return { created, skipped }
  }

  /**
   * Materializes the debt installments falling in `period`.
   *
   * The difference from a recurring rule is where it stops. A rule repeats
   * forever; a plan has a length, so a period before a plan's first due date or
   * past its last installment produces nothing — which is precisely why a
   * financed purchase could never be modelled as a rule.
   */
  private async generateSchedulePeriod(
    period: string,
  ): Promise<{ created: number; skipped: number }> {
    // Cancelled plans are excluded by the repository, so a cancelled purchase
    // can never materialize another instalment no matter which job runs.
    const schedules = await this.debtScheduleRepository.listActiveForGeneration()
    let created = 0
    let skipped = 0

    const alreadyGeneratedByTenant = new Map<string, Set<string>>()

    for (const schedule of schedules) {
      const index = installmentIndexFor(
        schedule,
        monthsBetween(toPeriod(schedule.firstDueDate), period),
      )

      // Outside the plan's life. Not skipped — there was never an obligation
      // here to skip, and counting it would report work that does not exist.
      if (index === null) {
        continue
      }

      if (!alreadyGeneratedByTenant.has(schedule.tenantId)) {
        alreadyGeneratedByTenant.set(
          schedule.tenantId,
          new Set(
            await this.obligationRepository.listGeneratedScheduleIdsForPeriod(
              schedule.tenantId,
              period,
            ),
          ),
        )
      }

      if (alreadyGeneratedByTenant.get(schedule.tenantId)?.has(schedule.id)) {
        skipped += 1
        continue
      }

      const instance = await this.obligationRepository.createGeneratedInstanceForSchedule({
        tenantId: schedule.tenantId,
        sourceType: 'debt_schedule',
        recurringRuleId: null,
        debtScheduleId: schedule.id,
        period,
        dueDate: occurrenceDate(period, installmentDayOfMonth(schedule)),
        // Says which instalment it is, so a board can tell "Nevera — 3 of 6"
        // from a rent that repeats forever.
        name: installmentLabel(schedule, index),
        // The last instalment absorbs whatever the others did not cover, so the
        // plan sums to exactly its principal.
        expectedAmountMinor: installmentAmountMinor(schedule, index),
        currency: schedule.currency,
      })

      // A concurrent run won the race against the (schedule, period) unique
      // index. Already generated, not an error — same as the rule path.
      if (instance === null) {
        skipped += 1
        continue
      }

      created += 1
    }

    return { created, skipped }
  }
}

function groupByTenant(
  rules: RecurringTransactionRule[],
): Map<string, RecurringTransactionRule[]> {
  const byTenant = new Map<string, RecurringTransactionRule[]>()

  for (const rule of rules) {
    const existing = byTenant.get(rule.tenantId)

    if (existing) {
      existing.push(rule)
      continue
    }

    byTenant.set(rule.tenantId, [rule])
  }

  return byTenant
}
