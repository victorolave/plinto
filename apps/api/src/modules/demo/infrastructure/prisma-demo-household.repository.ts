import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Membership } from '../../memberships/domain/membership.entity'
import { Tenant } from '../../tenants/domain/tenant.entity'
import { DemoHouseholdRepository } from '../domain/demo-household.repository'
import {
  DemoLocale,
  buildDemoHouseholdDataset,
  validateDemoHouseholdDataset,
} from '../domain/demo-household-dataset'

/**
 * Prisma adapter for the DemoHouseholdRepository port.
 *
 * Writes the whole example household — tenant, membership, and every row the
 * dataset builder produced — inside ONE transaction, replicating the same
 * invariants a real household's write paths enforce (a statement atomically
 * materialises its obligation; a payment links to an expense transaction),
 * the way the one-off manual seed script this was ported from did by hand.
 *
 * The dataset references everything by stable string keys; this is the only
 * place that turns those keys into real database ids.
 */
@Injectable()
export class PrismaDemoHouseholdRepository extends DemoHouseholdRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async createDemoHousehold(params: {
    ownerUserId: string
    tenantName: string
    locale: DemoLocale
    now: Date
  }): Promise<{ tenant: Tenant; membership: Membership }> {
    const dataset = buildDemoHouseholdDataset(params.now, params.locale)
    validateDemoHouseholdDataset(dataset)

    return this.prisma.$transaction(
      async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: params.tenantName, baseCurrency: dataset.currency, isDemo: true },
        })
        const membership = await tx.membership.create({
          data: { tenantId: tenant.id, userId: params.ownerUserId, role: 'owner' },
        })

        // Stable dataset key -> freshly generated database id, per aggregate.
        const accountId = new Map(dataset.accounts.map((a) => [a.key, randomUUID()]))
        const categoryId = new Map(dataset.categories.map((c) => [c.key, randomUUID()]))
        const creditLineId = new Map(dataset.creditLines.map((l) => [l.key, randomUUID()]))
        const statementId = new Map(dataset.creditLineStatements.map((s) => [s.key, randomUUID()]))
        const statementObligationId = new Map(
          dataset.creditLineStatements.map((s) => [s.obligationKey, randomUUID()]),
        )
        const manualObligationId = new Map(dataset.manualObligations.map((m) => [m.key, randomUUID()]))
        const recurringRuleId = new Map(dataset.recurringRules.map((r) => [r.key, randomUUID()]))
        const transactionId = new Map(dataset.transactions.map((t) => [t.key, randomUUID()]))
        const transferId = new Map(dataset.transfers.map((t) => [t.key, randomUUID()]))

        for (const a of dataset.accounts) {
          await tx.account.create({
            data: {
              id: accountId.get(a.key)!,
              tenantId: tenant.id,
              name: a.name,
              type: a.type,
              currency: dataset.currency,
            },
          })
        }

        for (const c of dataset.categories) {
          await tx.category.create({
            data: {
              id: categoryId.get(c.key)!,
              tenantId: tenant.id,
              name: c.name,
              type: c.type,
              color: c.color,
            },
          })
        }

        for (const l of dataset.creditLines) {
          await tx.creditLine.create({
            data: {
              id: creditLineId.get(l.key)!,
              tenantId: tenant.id,
              name: l.name,
              limitMinor: l.limitMinor,
              currency: dataset.currency,
              status: 'active',
            },
          })
        }

        // Each statement atomically materialises the obligation it demands —
        // same rule PrismaCreditLineStatementRepository.create() enforces for
        // a real household.
        for (const s of dataset.creditLineStatements) {
          await tx.creditLineStatement.create({
            data: {
              id: statementId.get(s.key)!,
              tenantId: tenant.id,
              creditLineId: creditLineId.get(s.creditLineKey)!,
              period: s.period,
              cutoffDate: s.cutoffDate,
              dueDate: s.dueDate,
              closingBalanceMinor: s.closingBalanceMinor,
              amountDueMinor: s.amountDueMinor,
              limitMinorSnapshot: s.limitMinorSnapshot,
              currency: dataset.currency,
            },
          })

          await tx.obligationInstance.create({
            data: {
              id: statementObligationId.get(s.obligationKey)!,
              tenantId: tenant.id,
              sourceType: 'credit_line',
              creditLineStatementId: statementId.get(s.key)!,
              period: s.period,
              dueDate: s.dueDate,
              name: s.obligationName,
              expectedAmountMinor: s.amountDueMinor,
              currency: dataset.currency,
            },
          })
        }

        // Debt schedule and recurring rules: created only, never
        // materialised into obligation instances here — that is the
        // obligation-generation job's job for a real household, and this
        // demo seeds enough manual/credit-line obligations on its own so the
        // dashboard is never empty.
        await tx.debtSchedule.create({
          data: {
            id: randomUUID(),
            tenantId: tenant.id,
            accountId: accountId.get(dataset.debtSchedule.accountKey)!,
            name: dataset.debtSchedule.name,
            principalMinor: dataset.debtSchedule.principalMinor,
            installmentMinor: dataset.debtSchedule.installmentMinor,
            installmentCount: dataset.debtSchedule.installmentCount,
            firstDueDate: dataset.debtSchedule.firstDueDate,
            currency: dataset.currency,
            status: 'active',
          },
        })

        for (const r of dataset.recurringRules) {
          await tx.recurringTransactionRule.create({
            data: {
              id: recurringRuleId.get(r.key)!,
              tenantId: tenant.id,
              accountId: accountId.get(r.accountKey)!,
              name: r.name,
              type: r.type,
              amountMinor: r.amountMinor,
              currency: dataset.currency,
              frequency: 'monthly',
              dayOfMonth: r.dayOfMonth,
              startDate: r.startDate,
              status: 'active',
            },
          })
        }

        for (const m of dataset.manualObligations) {
          await tx.obligationInstance.create({
            data: {
              id: manualObligationId.get(m.key)!,
              tenantId: tenant.id,
              sourceType: 'manual',
              period: m.period,
              dueDate: m.dueDate,
              name: m.name,
              expectedAmountMinor: m.expectedAmountMinor,
              currency: dataset.currency,
            },
          })
        }

        // Plain (non-transfer) transactions.
        for (const t of dataset.transactions) {
          if (t.transferKey) continue // created below, alongside their Transfer row
          await tx.transaction.create({
            data: {
              id: transactionId.get(t.key)!,
              tenantId: tenant.id,
              accountId: accountId.get(t.accountKey)!,
              type: t.type,
              amountMinor: t.amountMinor,
              currency: dataset.currency,
              description: t.description,
              occurredAt: t.occurredAt,
              categoryId: t.categoryKey ? categoryId.get(t.categoryKey)! : null,
              source: 'manual',
            },
          })
        }

        // Transfers, plus their two linked transaction legs.
        const transactionByKey = new Map(dataset.transactions.map((t) => [t.key, t]))
        for (const tr of dataset.transfers) {
          await tx.transfer.create({
            data: {
              id: transferId.get(tr.key)!,
              tenantId: tenant.id,
              sourceAccountId: accountId.get(tr.sourceAccountKey)!,
              destinationAccountId: accountId.get(tr.destinationAccountKey)!,
              sourceAmountMinor: tr.amountMinor,
              destinationAmountMinor: tr.amountMinor,
              sourceCurrency: dataset.currency,
              destinationCurrency: dataset.currency,
            },
          })

          const debitTx = transactionByKey.get(tr.debitTxKey)!
          const creditTx = transactionByKey.get(tr.creditTxKey)!

          await tx.transaction.create({
            data: {
              id: transactionId.get(debitTx.key)!,
              tenantId: tenant.id,
              accountId: accountId.get(debitTx.accountKey)!,
              type: 'expense',
              amountMinor: debitTx.amountMinor,
              currency: dataset.currency,
              description: debitTx.description,
              occurredAt: debitTx.occurredAt,
              transferId: transferId.get(tr.key)!,
              source: 'manual',
            },
          })

          await tx.transaction.create({
            data: {
              id: transactionId.get(creditTx.key)!,
              tenantId: tenant.id,
              accountId: accountId.get(creditTx.accountKey)!,
              type: 'income',
              amountMinor: creditTx.amountMinor,
              currency: dataset.currency,
              description: creditTx.description,
              occurredAt: creditTx.occurredAt,
              transferId: transferId.get(tr.key)!,
              source: 'manual',
            },
          })
        }

        for (const p of dataset.obligationPayments) {
          const obligationInstanceId =
            manualObligationId.get(p.obligationKey) ?? statementObligationId.get(p.obligationKey)
          const paymentTransactionId = transactionId.get(p.transactionKey)
          if (!obligationInstanceId || !paymentTransactionId) {
            // Validated by validateDemoHouseholdDataset() above; a mismatch here
            // means the dataset builder and this adapter have drifted apart.
            throw new Error(`Demo household dataset: unresolved obligation payment "${p.key}"`)
          }

          await tx.obligationPayment.create({
            data: {
              id: randomUUID(),
              tenantId: tenant.id,
              obligationInstanceId,
              transactionId: paymentTransactionId,
            },
          })
        }

        return { tenant, membership }
      },
      { timeout: 60_000 },
    )
  }

  /**
   * Deletes every tenant-scoped row in dependency-safe order, then the
   * tenant itself, in one transaction. Order matters: children before the
   * parents a Restrict foreign key would otherwise refuse to let go of
   * (obligation instances before the statements/schedules/rules that
   * produced them; obligation payments before the obligations they settle).
   */
  async deleteDemoHousehold(tenantId: string): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.obligationPayment.deleteMany({ where: { tenantId } })
        await tx.recurringTransactionExecution.deleteMany({ where: { tenantId } })
        await tx.obligationInstance.deleteMany({ where: { tenantId } })
        await tx.creditLineStatement.deleteMany({ where: { tenantId } })
        await tx.debtSchedule.deleteMany({ where: { tenantId } })
        await tx.recurringTransactionRule.deleteMany({ where: { tenantId } })
        await tx.transaction.deleteMany({ where: { tenantId } })
        await tx.transfer.deleteMany({ where: { tenantId } })
        await tx.account.deleteMany({ where: { tenantId } })
        await tx.category.deleteMany({ where: { tenantId } })
        await tx.creditLine.deleteMany({ where: { tenantId } })
        await tx.auditEvent.deleteMany({ where: { tenantId } })
        await tx.invitation.deleteMany({ where: { tenantId } })
        await tx.membership.deleteMany({ where: { tenantId } })
        // Any session pointing at this tenant is set NULL by the FK itself
        // (ON DELETE SET NULL); the service also clears it explicitly first,
        // best-effort, for callers reading their own session synchronously.
        await tx.tenant.delete({ where: { id: tenantId } })
      },
      { timeout: 60_000 },
    )
  }
}
