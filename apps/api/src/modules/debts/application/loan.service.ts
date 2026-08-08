import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { isLiabilityAccountType } from '@plinto/shared'
import { AccountRepository } from '../../accounts/domain/account.repository'
import { AuditService } from '../../audit/application/audit.service'
import { TransactionService } from '../../transactions/application/transaction.service'
import { Transaction, Transfer } from '../../transactions/domain/transaction.entity'

/**
 * Recording a loan the household received.
 *
 * A loan is money that arrives and is owed back, so it is a movement between
 * two accounts the household already holds — the lender's liability account and
 * whatever received the cash — not income. Modelling it that way is what keeps
 * it out of the household's income figure structurally rather than by
 * convention, and it is the distinction the source spreadsheet maintains by
 * hand in a column beside its income.
 *
 * The mechanism is therefore an ordinary transfer, and this service does not
 * reimplement one. What it adds is the meaning: which side must be the lender,
 * that the two must agree on a currency, and an audit entry that says a loan
 * was received rather than that money moved.
 */
@Injectable()
export class LoanService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionService: TransactionService,
    private readonly auditService: AuditService,
  ) {}

  async recordLoan(params: {
    tenantId: string
    actorUserId: string | null
    correlationId: string
    lenderAccountId: string
    destinationAccountId: string
    amountMinor: number
    description?: string
    occurredAt?: string
  }): Promise<{ transfer: Transfer; debit: Transaction; credit: Transaction }> {
    const [lender, destination] = await Promise.all([
      this.accountRepository.findByIdForTenant(params.lenderAccountId, params.tenantId),
      this.accountRepository.findByIdForTenant(
        params.destinationAccountId,
        params.tenantId,
      ),
    ])

    if (!lender || !destination) {
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found for the active tenant',
      })
    }

    if (!isLiabilityAccountType(lender.type)) {
      throw new UnprocessableEntityException({
        code: 'LENDER_NOT_A_LIABILITY',
        message: 'A loan must come from a debt or credit account',
      })
    }

    // Borrowing to pay off another debt is refinancing, which PRD-007 puts out
    // of scope. Rejecting it is better than recording it as an ordinary loan
    // and leaving somebody to discover later that the model never understood
    // what they meant.
    if (isLiabilityAccountType(destination.type)) {
      throw new UnprocessableEntityException({
        code: 'LOAN_DESTINATION_IS_A_LIABILITY',
        message: 'A loan must land in an account the household holds, not in another debt',
      })
    }

    // Cross-currency borrowing needs a rate and a stated fee, which is the
    // transfer contract's business (PRD-003) and not something to infer here.
    if (lender.currency !== destination.currency) {
      throw new UnprocessableEntityException({
        code: 'LOAN_CURRENCY_MISMATCH',
        message: 'The lender and the receiving account must share a currency',
      })
    }

    const result = await this.transactionService.createTransfer({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
      sourceAccountId: params.lenderAccountId,
      destinationAccountId: params.destinationAccountId,
      sourceAmountMinor: params.amountMinor,
      description: params.description,
      occurredAt: params.occurredAt,
    })

    // Recorded on top of the transfer's own audit entry, deliberately. That one
    // says money moved between two accounts, which is the ledger fact; this one
    // says the household took on a debt, which is the fact somebody reading the
    // log later will be looking for.
    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'loan.received',
      resourceType: 'transfer',
      resourceId: result.transfer.id,
      correlationId: params.correlationId,
      metadata: {
        lenderAccountId: params.lenderAccountId,
        destinationAccountId: params.destinationAccountId,
        amountMinor: params.amountMinor,
        currency: lender.currency,
      },
    })

    return result
  }
}
