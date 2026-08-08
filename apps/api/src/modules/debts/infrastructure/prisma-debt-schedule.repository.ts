import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { DebtSchedule, DebtScheduleStatus } from '../domain/debt-schedule.entity'
import {
  DebtScheduleRepository,
  DebtScheduleWithProgress,
} from '../domain/debt-schedule.repository'

type RawProgressRow = {
  id: string
  paid_minor: bigint | string | number | null
  generated_count: bigint | string | number | null
}

/**
 * Prisma adapter for the DebtScheduleRepository port. This is the only unit
 * that knows about Prisma for the debt-schedules aggregate.
 */
@Injectable()
export class PrismaDebtScheduleRepository extends DebtScheduleRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async create(data: {
    tenantId: string
    accountId: string
    name: string
    principalMinor: number
    installmentMinor: number
    installmentCount: number
    firstDueDate: Date
    currency: string
  }): Promise<DebtSchedule> {
    return this.prisma.debtSchedule.create({ data })
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<DebtSchedule | null> {
    return this.prisma.debtSchedule.findFirst({ where: { id, tenantId } })
  }

  /**
   * Progress is aggregated in Postgres, never by loading payments into memory.
   *
   * The join runs through the obligations a schedule produced and the
   * transactions that settled them, so "paid" means the same thing here as it
   * does on the obligations board — one definition, not two that can drift.
   */
  async listWithProgress(tenantId: string): Promise<DebtScheduleWithProgress[]> {
    const schedules = await this.prisma.debtSchedule.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
    })

    if (schedules.length === 0) {
      return []
    }

    const rows = await this.prisma.$queryRaw<RawProgressRow[]>`
      SELECT
        s."id" AS id,
        COALESCE(SUM(p.paid), 0) AS paid_minor,
        COUNT(DISTINCT i."id") AS generated_count
      FROM "debt_schedules" s
      LEFT JOIN "obligation_instances" i ON i."debt_schedule_id" = s."id"
      LEFT JOIN (
        SELECT op."obligation_instance_id" AS instance_id, SUM(t."amount_minor") AS paid
        FROM "obligation_payments" op
        JOIN "transactions" t ON t."id" = op."transaction_id"
        GROUP BY op."obligation_instance_id"
      ) p ON p.instance_id = i."id"
      WHERE s."tenant_id" = ${tenantId}
      GROUP BY s."id"
    `

    const progress = new Map(
      rows.map((row) => [
        row.id,
        { paidMinor: toNumber(row.paid_minor), generatedCount: toNumber(row.generated_count) },
      ]),
    )

    return schedules.map((schedule) => ({
      schedule,
      paidMinor: progress.get(schedule.id)?.paidMinor ?? 0,
      generatedCount: progress.get(schedule.id)?.generatedCount ?? 0,
    }))
  }

  /**
   * Cancelled schedules are excluded here rather than filtered by the caller,
   * so a cancelled plan can never materialize another installment no matter
   * which job runs.
   */
  async listActiveForGeneration(): Promise<DebtSchedule[]> {
    return this.prisma.debtSchedule.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' },
    })
  }

  async rename(id: string, tenantId: string, name: string): Promise<DebtSchedule | null> {
    // updateMany, not update: a non-matching id must read as "not found for
    // this tenant" rather than throw, and it is what scopes the write.
    const result = await this.prisma.debtSchedule.updateMany({
      where: { id, tenantId },
      data: { name },
    })

    return result.count > 0 ? this.findByIdForTenant(id, tenantId) : null
  }

  async setStatus(
    id: string,
    tenantId: string,
    status: DebtScheduleStatus,
  ): Promise<DebtSchedule | null> {
    const result = await this.prisma.debtSchedule.updateMany({
      where: { id, tenantId },
      data: { status },
    })

    return result.count > 0 ? this.findByIdForTenant(id, tenantId) : null
  }
}

/**
 * Postgres widens SUM and COUNT to bigint, which the driver hands back as a
 * BigInt or a numeric string. Amounts stay within safe-integer range, so
 * narrowing is lossless and keeps the domain on plain numbers.
 */
function toNumber(value: bigint | string | number | null): number {
  return value === null ? 0 : Number(value)
}
