import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { AuditService } from '../../audit/application/audit.service'
import { CreditLine } from '../domain/credit-line.entity'
import { CreditLineRepository } from '../domain/credit-line.repository'
import {
  CreditLineStatement,
  availableMinor,
  periodOfCutoff,
} from '../domain/credit-line-statement.entity'
import { CreditLineStatementRepository } from '../domain/credit-line-statement.repository'

/** A statement with the figures derived from it. */
export interface CreditLineStatementView {
  statement: CreditLineStatement
  availableMinor: number
}

/** What a line looks like on the board: its last statement, and what it says. */
export interface CreditLineWithLatestStatement {
  line: CreditLine
  latestStatement: CreditLineStatement | null
  availableMinor: number | null
}

const toView = (statement: CreditLineStatement): CreditLineStatementView => ({
  statement,
  availableMinor: availableMinor(statement),
})

/**
 * Statements a credit line issued. See PRD-011.
 *
 * Recording one materializes the obligation it demands, so a bill the lender
 * issued reaches the household's board without a second step to remember. That
 * write is atomic in the repository: a statement whose obligation is missing
 * is a bill nobody sees.
 *
 * Nothing here is scheduled. Rules and installments can be projected because
 * they are predictable; a statement exists when the lender issues it, and no
 * job can know that in advance.
 */
@Injectable()
export class CreditLineStatementService {
  constructor(
    private readonly statementRepository: CreditLineStatementRepository,
    private readonly creditLineRepository: CreditLineRepository,
    private readonly auditService: AuditService,
  ) {}

  async recordStatement(params: {
    tenantId: string
    actorUserId: string | null
    correlationId: string
    creditLineId: string
    cutoffDate: string
    dueDate: string
    closingBalanceMinor: number
    amountDueMinor: number
  }): Promise<CreditLineStatementView> {
    const line = await this.creditLineRepository.findByIdForTenant(
      params.creditLineId,
      params.tenantId,
    )

    if (!line) {
      throw new NotFoundException({
        code: 'CREDIT_LINE_NOT_FOUND',
        message: 'Credit line not found for the active tenant',
      })
    }

    // A closed line issues nothing. Recording against one would produce an
    // obligation for a bill that cannot arrive.
    if (line.status !== 'active') {
      throw new UnprocessableEntityException({
        code: 'CREDIT_LINE_CLOSED',
        message: 'A closed credit line cannot record new statements',
      })
    }

    const cutoffDate = new Date(params.cutoffDate)
    const dueDate = new Date(params.dueDate)

    // A bill cannot fall due before the statement that demands it closed.
    if (dueDate.getTime() < cutoffDate.getTime()) {
      throw new UnprocessableEntityException({
        code: 'CREDIT_STATEMENT_DUE_BEFORE_CUTOFF',
        message: 'The due date cannot fall before the cutoff date',
      })
    }

    const statement = await this.statementRepository.create({
      tenantId: params.tenantId,
      creditLineId: line.id,
      lineName: line.name,
      // Derived from the cutoff, never given: a statement must not be filed
      // under a month its cutoff does not fall in.
      period: periodOfCutoff(cutoffDate),
      cutoffDate,
      dueDate,
      closingBalanceMinor: params.closingBalanceMinor,
      amountDueMinor: params.amountDueMinor,
      // Frozen here. Raising the ceiling tomorrow must not restate what this
      // statement said was available.
      limitMinorSnapshot: line.limitMinor,
      // Inherited, never given: the statement bills that line, so it cannot be
      // denominated in anything else.
      currency: line.currency,
    })

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'credit_line_statement.recorded',
      resourceType: 'credit_line_statement',
      resourceId: statement.id,
      correlationId: params.correlationId,
      metadata: {
        creditLineId: line.id,
        period: statement.period,
        closingBalanceMinor: params.closingBalanceMinor,
        amountDueMinor: params.amountDueMinor,
      },
    })

    return toView(statement)
  }

  async listStatements(
    creditLineId: string,
    tenantId: string,
  ): Promise<CreditLineStatementView[]> {
    const line = await this.creditLineRepository.findByIdForTenant(creditLineId, tenantId)

    if (!line) {
      throw new NotFoundException({
        code: 'CREDIT_LINE_NOT_FOUND',
        message: 'Credit line not found for the active tenant',
      })
    }

    const statements = await this.statementRepository.listForLine(creditLineId, tenantId)

    return statements.map(toView)
  }

  /**
   * Every line with what its last statement said.
   *
   * A line with no statement yet reports nulls rather than zeros. Zero
   * available and zero owed is a claim; "not known yet" is the truth, and the
   * two must not look the same on a board.
   */
  async listLinesWithLatestStatement(
    tenantId: string,
  ): Promise<CreditLineWithLatestStatement[]> {
    const [lines, latest] = await Promise.all([
      this.creditLineRepository.listForTenant(tenantId),
      this.statementRepository.listLatestPerLine(tenantId),
    ])

    const byLine = new Map(latest.map((statement) => [statement.creditLineId, statement]))

    return lines.map((line) => {
      const latestStatement = byLine.get(line.id) ?? null

      return {
        line,
        latestStatement,
        availableMinor: latestStatement ? availableMinor(latestStatement) : null,
      }
    })
  }

  /**
   * Corrects a statement, and the obligation it produced with it.
   *
   * The guard is that the amount due may not drop below what has already been
   * paid against it. Lowering it there would leave the obligation reporting an
   * overpayment the household never made — and if the lender really did
   * correct downwards after payment, the payment is what should be undone
   * first, which `DELETE /obligations/{id}/payments/{transactionId}` already
   * does.
   */
  async updateStatement(params: {
    tenantId: string
    actorUserId: string | null
    correlationId: string
    id: string
    dueDate?: string
    closingBalanceMinor?: number
    amountDueMinor?: number
  }): Promise<CreditLineStatementView> {
    const found = await this.statementRepository.findWithPayment(params.id, params.tenantId)

    if (!found) {
      throw new NotFoundException({
        code: 'CREDIT_STATEMENT_NOT_FOUND',
        message: 'Credit line statement not found for the active tenant',
      })
    }

    const nextAmountDue = params.amountDueMinor ?? found.statement.amountDueMinor
    const nextClosingBalance =
      params.closingBalanceMinor ?? found.statement.closingBalanceMinor

    if (nextAmountDue < found.paidMinor) {
      throw new UnprocessableEntityException({
        code: 'CREDIT_STATEMENT_BELOW_PAID',
        message:
          'The amount due cannot be lowered below what has already been paid against it',
      })
    }

    // Re-checked here because either field may move on its own, and the pair
    // has to stay coherent whichever one the caller sent.
    if (nextAmountDue > nextClosingBalance) {
      throw new UnprocessableEntityException({
        code: 'CREDIT_STATEMENT_DUE_ABOVE_BALANCE',
        message: 'The amount due cannot exceed the closing balance',
      })
    }

    const dueDate = params.dueDate ? new Date(params.dueDate) : undefined

    if (dueDate && dueDate.getTime() < found.statement.cutoffDate.getTime()) {
      throw new UnprocessableEntityException({
        code: 'CREDIT_STATEMENT_DUE_BEFORE_CUTOFF',
        message: 'The due date cannot fall before the cutoff date',
      })
    }

    const statement = await this.statementRepository.update(params.id, params.tenantId, {
      dueDate,
      closingBalanceMinor: params.closingBalanceMinor,
      amountDueMinor: params.amountDueMinor,
    })

    if (!statement) {
      throw new NotFoundException({
        code: 'CREDIT_STATEMENT_NOT_FOUND',
        message: 'Credit line statement not found for the active tenant',
      })
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'credit_line_statement.corrected',
      resourceType: 'credit_line_statement',
      resourceId: statement.id,
      correlationId: params.correlationId,
      metadata: {
        closingBalanceMinor: params.closingBalanceMinor,
        amountDueMinor: params.amountDueMinor,
      },
    })

    return toView(statement)
  }
}
