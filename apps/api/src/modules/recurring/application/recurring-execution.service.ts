import { Injectable } from '@nestjs/common'
import { RecurringTransactionRepository } from '../domain/recurring-transaction.repository'

@Injectable()
export class RecurringExecutionService {
  constructor(private readonly recurringRepository: RecurringTransactionRepository) {}

  async executeDue(params: {
    dueDate: Date | string
    jobId?: string
  }): Promise<{ created: number; skipped: number }> {
    const dueDate = typeof params.dueDate === 'string'
      ? new Date(params.dueDate)
      : params.dueDate
    const period = toUtcPeriod(dueDate)
    const rules = await this.recurringRepository.listActiveMonthlyRulesDueBy(dueDate)
    let created = 0
    let skipped = 0

    for (const rule of rules) {
      const idempotencyKey = `recurring:${rule.id}:${period}`
      const existing = await this.recurringRepository.findExecutionByKey(
        rule.tenantId,
        idempotencyKey,
      )

      if (existing) {
        skipped += 1
        continue
      }

      await this.recurringRepository.createExecutionTransaction({
        rule,
        period,
        idempotencyKey,
        occurredAt: toUtcOccurrenceDate(period, rule.dayOfMonth),
        jobId: params.jobId,
      })
      created += 1
    }

    return { created, skipped }
  }
}

function toUtcPeriod(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function toUtcOccurrenceDate(period: string, dayOfMonth: number): Date {
  return new Date(`${period}-${String(dayOfMonth).padStart(2, '0')}T00:00:00.000Z`)
}
