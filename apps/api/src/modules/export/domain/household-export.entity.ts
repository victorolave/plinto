import type { MembershipRole } from '../../memberships/domain/membership.entity'
import type { AccountType } from '../../accounts/domain/account.entity'
import type { TransactionType, TransactionSource } from '../../transactions/domain/transaction.entity'
import type { RecurringTransactionFrequency, RecurringRuleStatus, RecurringExecutionStatus } from '../../recurring/domain/recurring-transaction.entity'
import type { ObligationSourceType } from '../../obligations/domain/obligation.entity'
import type { DebtScheduleStatus } from '../../debts/domain/debt-schedule.entity'
import type { CreditLineStatus } from '../../credit/domain/credit-line.entity'
import type { AuditSource } from '../../audit/domain/audit-event.entity'

/**
 * Every row type below mirrors its Prisma model's own columns exactly —
 * `tenantId` included — with two deliberate exceptions: `TenantExportRow`
 * and `MemberExportRow` carry the narrower, purpose-built shapes the export
 * format documents, not their full underlying tables. `Session`,
 * `Invitation` and `User.idpSub` are excluded everywhere: none of them are
 * household data a household owns an export of.
 *
 * Dates are `Date` here (what Prisma returns) and are serialized to ISO
 * strings only when the bundle is assembled into JSON — keeping the
 * repository's contract typed as real dates lets the service sort and
 * reason about them before that happens.
 */

export interface TenantExportRow {
  id: string
  name: string
  baseCurrency: string
  createdAt: Date
}

export interface MemberExportRow {
  userId: string
  email: string
  name: string | null
  role: MembershipRole
  createdAt: Date
}

export interface CategoryExportRow {
  id: string
  tenantId: string
  name: string
  type: TransactionType
  color: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AccountExportRow {
  id: string
  tenantId: string
  name: string
  type: AccountType
  currency: string
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
}

export interface CreditLineExportRow {
  id: string
  tenantId: string
  name: string
  limitMinor: number
  currency: string
  status: CreditLineStatus
  createdAt: Date
  updatedAt: Date
}

export interface CreditLineStatementExportRow {
  id: string
  tenantId: string
  creditLineId: string
  period: string
  cutoffDate: Date
  dueDate: Date
  closingBalanceMinor: number
  amountDueMinor: number
  limitMinorSnapshot: number
  currency: string
  createdAt: Date
  updatedAt: Date
}

export interface DebtScheduleExportRow {
  id: string
  tenantId: string
  accountId: string
  name: string
  principalMinor: number
  installmentMinor: number
  installmentCount: number
  firstDueDate: Date
  currency: string
  status: DebtScheduleStatus
  createdAt: Date
  updatedAt: Date
}

export interface RecurringRuleExportRow {
  id: string
  tenantId: string
  accountId: string
  name: string
  type: TransactionType
  amountMinor: number
  currency: string
  frequency: RecurringTransactionFrequency
  dayOfMonth: number
  startDate: Date
  status: RecurringRuleStatus
  createdAt: Date
  updatedAt: Date
}

export interface TransferExportRow {
  id: string
  tenantId: string
  sourceAccountId: string
  destinationAccountId: string
  sourceAmountMinor: number
  destinationAmountMinor: number
  sourceCurrency: string
  destinationCurrency: string
  /** Prisma `Decimal | null` rendered as a string, never a `Decimal` instance. */
  fxRate: string | null
  feeMinor: number | null
  rateSource: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TransactionExportRow {
  id: string
  tenantId: string
  accountId: string
  type: TransactionType
  amountMinor: number
  currency: string
  description: string | null
  occurredAt: Date
  transferId: string | null
  categoryId: string | null
  source: TransactionSource
  recurringRuleId: string | null
  recurringPeriod: string | null
  idempotencyKey: string | null
  createdAt: Date
  updatedAt: Date
}

export interface RecurringExecutionExportRow {
  id: string
  tenantId: string
  ruleId: string
  period: string
  idempotencyKey: string
  transactionId: string
  status: RecurringExecutionStatus
  jobId: string | null
  createdAt: Date
}

export interface ObligationInstanceExportRow {
  id: string
  tenantId: string
  sourceType: ObligationSourceType
  recurringRuleId: string | null
  debtScheduleId: string | null
  creditLineStatementId: string | null
  period: string
  dueDate: Date
  name: string
  expectedAmountMinor: number
  currency: string
  createdAt: Date
  updatedAt: Date
}

export interface ObligationPaymentExportRow {
  id: string
  tenantId: string
  obligationInstanceId: string
  transactionId: string
  createdAt: Date
}

export interface AuditEventExportRow {
  id: string
  tenantId: string
  actorUserId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  source: AuditSource
  correlationId: string
  createdAt: Date
  metadata: unknown | null
}

/** Every tenant-scoped table this household owns, parent-first, ready to assemble into the export bundle. */
export interface HouseholdExportData {
  tenant: TenantExportRow
  members: MemberExportRow[]
  categories: CategoryExportRow[]
  accounts: AccountExportRow[]
  creditLines: CreditLineExportRow[]
  creditLineStatements: CreditLineStatementExportRow[]
  debtSchedules: DebtScheduleExportRow[]
  recurringRules: RecurringRuleExportRow[]
  transfers: TransferExportRow[]
  transactions: TransactionExportRow[]
  recurringExecutions: RecurringExecutionExportRow[]
  obligationInstances: ObligationInstanceExportRow[]
  obligationPayments: ObligationPaymentExportRow[]
  auditEvents: AuditEventExportRow[]
}

/** One transaction, joined with the display names the CSV needs — never the JSON export, which links by id instead. */
export interface TransactionCsvRow {
  occurredAt: Date
  type: TransactionType
  amountMinor: number
  currency: string
  accountName: string
  categoryName: string | null
  description: string | null
  source: TransactionSource
  transferId: string | null
  recurringRuleName: string | null
  obligationName: string | null
}

/**
 * Port: the read-only persistence contract the export feature depends on.
 * Deliberately two methods, not fourteen — the JSON bundle and the CSV
 * ledger are the only two things ever assembled from this data, so the
 * port's shape follows its two callers rather than exposing one query per
 * table.
 */
export abstract class HouseholdExportRepository {
  /** Null when the tenant itself cannot be found — defensive; TenantGuard already verified it exists. */
  abstract getHouseholdData(tenantId: string): Promise<HouseholdExportData | null>

  abstract listTransactionsForCsv(tenantId: string): Promise<TransactionCsvRow[]>

  /**
   * Just the tenant's name, for the CSV filename. Kept separate from
   * `getHouseholdData` so building the (much cheaper) CSV export never pays
   * for loading every other table first.
   */
  abstract getTenantName(tenantId: string): Promise<string | null>
}
