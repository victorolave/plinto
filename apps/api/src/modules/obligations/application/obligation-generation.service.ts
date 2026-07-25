import { Injectable } from '@nestjs/common'
import { occurrenceDate, periodRange, toPeriod } from '../../../common/period'
import { RecurringTransactionRule } from '../../recurring/domain/recurring-transaction.entity'
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository'
import { ObligationRepository } from '../domain/obligation.repository'

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
      const outcome = await this.generatePeriod(period)
      created += outcome.created
      skipped += outcome.skipped
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
