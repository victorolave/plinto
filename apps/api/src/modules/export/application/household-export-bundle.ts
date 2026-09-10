import type { MembershipRole } from '../../memberships/domain/membership.entity'
import type { AccountType } from '../../accounts/domain/account.entity'
import type { TransactionType, TransactionSource } from '../../transactions/domain/transaction.entity'
import type {
  RecurringTransactionFrequency,
  RecurringRuleStatus,
  RecurringExecutionStatus,
} from '../../recurring/domain/recurring-transaction.entity'
import type { ObligationSourceType } from '../../obligations/domain/obligation.entity'
import type { DebtScheduleStatus } from '../../debts/domain/debt-schedule.entity'
import type { CreditLineStatus } from '../../credit/domain/credit-line.entity'
import type { AuditSource } from '../../audit/domain/audit-event.entity'
import type { HouseholdExportData } from '../domain/household-export.entity'
import { buildCurrencyCatalogue } from './currency-catalogue'
import { getApiVersion } from './api-version'

/** JSON-safe mirror of each row type: every `Date` becomes an ISO string. */
export interface HouseholdExportBundle {
  format: 'plinto-household-export'
  version: 1
  exportedAt: string
  generator: { app: 'plinto'; apiVersion: string }
  money: { note: string; currencies: Record<string, { exponent: number }> }
  tenant: { id: string; name: string; baseCurrency: string; createdAt: string }
  members: Array<{
    userId: string
    email: string
    name: string | null
    role: MembershipRole
    createdAt: string
  }>
  categories: Array<{
    id: string
    tenantId: string
    name: string
    type: TransactionType
    color: string | null
    createdAt: string
    updatedAt: string
  }>
  accounts: Array<{
    id: string
    tenantId: string
    name: string
    type: AccountType
    currency: string
    createdAt: string
    updatedAt: string
    archivedAt: string | null
  }>
  creditLines: Array<{
    id: string
    tenantId: string
    name: string
    limitMinor: number
    currency: string
    status: CreditLineStatus
    createdAt: string
    updatedAt: string
  }>
  creditLineStatements: Array<{
    id: string
    tenantId: string
    creditLineId: string
    period: string
    cutoffDate: string
    dueDate: string
    closingBalanceMinor: number
    amountDueMinor: number
    limitMinorSnapshot: number
    currency: string
    createdAt: string
    updatedAt: string
  }>
  debtSchedules: Array<{
    id: string
    tenantId: string
    accountId: string
    name: string
    principalMinor: number
    installmentMinor: number
    installmentCount: number
    firstDueDate: string
    currency: string
    status: DebtScheduleStatus
    createdAt: string
    updatedAt: string
  }>
  recurringRules: Array<{
    id: string
    tenantId: string
    accountId: string
    name: string
    type: TransactionType
    amountMinor: number
    currency: string
    frequency: RecurringTransactionFrequency
    dayOfMonth: number
    startDate: string
    status: RecurringRuleStatus
    createdAt: string
    updatedAt: string
  }>
  transfers: Array<{
    id: string
    tenantId: string
    sourceAccountId: string
    destinationAccountId: string
    sourceAmountMinor: number
    destinationAmountMinor: number
    sourceCurrency: string
    destinationCurrency: string
    fxRate: string | null
    feeMinor: number | null
    rateSource: string | null
    createdAt: string
    updatedAt: string
  }>
  transactions: Array<{
    id: string
    tenantId: string
    accountId: string
    type: TransactionType
    amountMinor: number
    currency: string
    description: string | null
    occurredAt: string
    transferId: string | null
    categoryId: string | null
    source: TransactionSource
    recurringRuleId: string | null
    recurringPeriod: string | null
    idempotencyKey: string | null
    createdAt: string
    updatedAt: string
  }>
  recurringExecutions: Array<{
    id: string
    tenantId: string
    ruleId: string
    period: string
    idempotencyKey: string
    transactionId: string
    status: RecurringExecutionStatus
    jobId: string | null
    createdAt: string
  }>
  obligationInstances: Array<{
    id: string
    tenantId: string
    sourceType: ObligationSourceType
    recurringRuleId: string | null
    debtScheduleId: string | null
    creditLineStatementId: string | null
    period: string
    dueDate: string
    name: string
    expectedAmountMinor: number
    currency: string
    createdAt: string
    updatedAt: string
  }>
  obligationPayments: Array<{
    id: string
    tenantId: string
    obligationInstanceId: string
    transactionId: string
    createdAt: string
  }>
  auditEvents: Array<{
    id: string
    tenantId: string
    actorUserId: string | null
    action: string
    resourceType: string
    resourceId: string | null
    source: AuditSource
    correlationId: string
    createdAt: string
    metadata: unknown | null
  }>
}

function iso(date: Date): string {
  return date.toISOString()
}

function isoOrNull(date: Date | null): string | null {
  return date != null ? date.toISOString() : null
}

/** Every currency code that appears anywhere in the household's data. */
function collectCurrencies(data: HouseholdExportData): string[] {
  const currencies = new Set<string>([data.tenant.baseCurrency])

  for (const row of data.accounts) currencies.add(row.currency)
  for (const row of data.creditLines) currencies.add(row.currency)
  for (const row of data.creditLineStatements) currencies.add(row.currency)
  for (const row of data.debtSchedules) currencies.add(row.currency)
  for (const row of data.recurringRules) currencies.add(row.currency)
  for (const row of data.transfers) {
    currencies.add(row.sourceCurrency)
    currencies.add(row.destinationCurrency)
  }
  for (const row of data.transactions) currencies.add(row.currency)
  for (const row of data.obligationInstances) currencies.add(row.currency)

  return Array.from(currencies)
}

/**
 * Assembles the versioned export bundle from repository-shaped data. Pure:
 * no I/O, no `Date.now()` besides the `exportedAt` passed in, so it is
 * exercised directly against a mocked repository's output in tests.
 */
export function buildHouseholdExportBundle(
  data: HouseholdExportData,
  exportedAt: Date,
): HouseholdExportBundle {
  return {
    format: 'plinto-household-export',
    version: 1,
    exportedAt: iso(exportedAt),
    generator: { app: 'plinto', apiVersion: getApiVersion() },
    money: {
      note:
        'amounts are integer minor units; see currencies below for how many ' +
        'decimal places each one uses (0 means the minor unit is the whole unit)',
      currencies: buildCurrencyCatalogue(collectCurrencies(data)),
    },
    tenant: {
      id: data.tenant.id,
      name: data.tenant.name,
      baseCurrency: data.tenant.baseCurrency,
      createdAt: iso(data.tenant.createdAt),
    },
    members: data.members.map((row) => ({ ...row, createdAt: iso(row.createdAt) })),
    categories: data.categories.map((row) => ({
      ...row,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    })),
    accounts: data.accounts.map((row) => ({
      ...row,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
      archivedAt: isoOrNull(row.archivedAt),
    })),
    creditLines: data.creditLines.map((row) => ({
      ...row,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    })),
    creditLineStatements: data.creditLineStatements.map((row) => ({
      ...row,
      cutoffDate: iso(row.cutoffDate),
      dueDate: iso(row.dueDate),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    })),
    debtSchedules: data.debtSchedules.map((row) => ({
      ...row,
      firstDueDate: iso(row.firstDueDate),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    })),
    recurringRules: data.recurringRules.map((row) => ({
      ...row,
      startDate: iso(row.startDate),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    })),
    transfers: data.transfers.map((row) => ({
      ...row,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    })),
    transactions: data.transactions.map((row) => ({
      ...row,
      occurredAt: iso(row.occurredAt),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    })),
    recurringExecutions: data.recurringExecutions.map((row) => ({
      ...row,
      createdAt: iso(row.createdAt),
    })),
    obligationInstances: data.obligationInstances.map((row) => ({
      ...row,
      dueDate: iso(row.dueDate),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    })),
    obligationPayments: data.obligationPayments.map((row) => ({
      ...row,
      createdAt: iso(row.createdAt),
    })),
    auditEvents: data.auditEvents.map((row) => ({
      ...row,
      createdAt: iso(row.createdAt),
    })),
  }
}
