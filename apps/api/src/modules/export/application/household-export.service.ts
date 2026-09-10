import { Injectable, NotFoundException } from '@nestjs/common'
import { AuditService } from '../../audit/application/audit.service'
import { HouseholdExportRepository } from '../domain/household-export.entity'
import { buildHouseholdExportBundle } from './household-export-bundle'
import { buildTransactionsCsv } from './transactions-csv'
import { dateStamp, slugifyTenantName } from './slug'

export interface HouseholdExportContext {
  tenantId: string
  actorUserId: string | null
  correlationId: string
}

@Injectable()
export class HouseholdExportService {
  constructor(
    private readonly exportRepository: HouseholdExportRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Builds the whole-household JSON bundle, records the audit event, and
   * returns the finished payload and filename. Deliberately does all of this
   * — including the audit write — before returning, so the controller can
   * set response headers only once this has fully succeeded: a failure here
   * throws before a single header reaches the client.
   */
  async exportHousehold(
    context: HouseholdExportContext,
  ): Promise<{ json: string; filename: string }> {
    const data = await this.exportRepository.getHouseholdData(context.tenantId)

    if (!data) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      })
    }

    const exportedAt = new Date()
    const bundle = buildHouseholdExportBundle(data, exportedAt)

    const counts = {
      members: data.members.length,
      categories: data.categories.length,
      accounts: data.accounts.length,
      creditLines: data.creditLines.length,
      creditLineStatements: data.creditLineStatements.length,
      debtSchedules: data.debtSchedules.length,
      recurringRules: data.recurringRules.length,
      transfers: data.transfers.length,
      transactions: data.transactions.length,
      recurringExecutions: data.recurringExecutions.length,
      obligationInstances: data.obligationInstances.length,
      obligationPayments: data.obligationPayments.length,
      auditEvents: data.auditEvents.length,
    }

    await this.auditService.record({
      tenantId: context.tenantId,
      actorUserId: context.actorUserId,
      action: 'tenant.exported',
      resourceType: 'tenant',
      resourceId: context.tenantId,
      correlationId: context.correlationId,
      metadata: { format: 'json', counts },
    })

    return {
      json: JSON.stringify(bundle, null, 2),
      filename: `plinto-${slugifyTenantName(data.tenant.name)}-${dateStamp(exportedAt)}.json`,
    }
  }

  /**
   * Builds the transaction ledger as CSV, records the audit event, and
   * returns the finished payload and filename. Same all-before-returning
   * contract as `exportHousehold`.
   */
  async exportTransactionsCsv(
    context: HouseholdExportContext,
  ): Promise<{ csv: string; filename: string }> {
    const tenantName = await this.exportRepository.getTenantName(context.tenantId)

    if (tenantName === null) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      })
    }

    const rows = await this.exportRepository.listTransactionsForCsv(context.tenantId)
    const csv = buildTransactionsCsv(rows)

    await this.auditService.record({
      tenantId: context.tenantId,
      actorUserId: context.actorUserId,
      action: 'tenant.exported',
      resourceType: 'tenant',
      resourceId: context.tenantId,
      correlationId: context.correlationId,
      metadata: { format: 'csv', counts: { transactions: rows.length } },
    })

    return {
      csv,
      filename: `plinto-${slugifyTenantName(tenantName)}-transactions-${dateStamp(new Date())}.csv`,
    }
  }
}
