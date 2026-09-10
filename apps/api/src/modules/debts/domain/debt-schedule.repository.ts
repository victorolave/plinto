import { DebtSchedule, DebtScheduleStatus } from './debt-schedule.entity'

/** A schedule with what its own obligations have been paid, aggregated in SQL. */
export interface DebtScheduleWithProgress {
  schedule: DebtSchedule
  /** Sum of the payments settling this schedule's installments. */
  paidMinor: number
  /** How many of its installments have been materialized as obligations. */
  generatedCount: number
}

/**
 * Port: the debt-schedule persistence contract the application layer depends
 * on. Adapters live in the infrastructure layer and implement this abstract
 * class, which doubles as the DI token.
 */
export abstract class DebtScheduleRepository {
  abstract create(data: {
    tenantId: string
    accountId: string
    name: string
    principalMinor: number
    installmentMinor: number
    installmentCount: number
    firstDueDate: Date
    currency: string
  }): Promise<DebtSchedule>

  abstract findByIdForTenant(id: string, tenantId: string): Promise<DebtSchedule | null>

  /**
   * Every schedule of a household with its repayment progress. Aggregated in
   * the database rather than by loading payments into memory, for the same
   * reason the obligation summary is.
   */
  abstract listWithProgress(tenantId: string): Promise<DebtScheduleWithProgress[]>

  /** Active schedules across every tenant, for the generation job. */
  abstract listActiveForGeneration(): Promise<DebtSchedule[]>

  abstract rename(id: string, tenantId: string, name: string): Promise<DebtSchedule | null>

  abstract setStatus(
    id: string,
    tenantId: string,
    status: DebtScheduleStatus,
  ): Promise<DebtSchedule | null>
}
