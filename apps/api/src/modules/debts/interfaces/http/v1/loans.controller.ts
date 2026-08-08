import { Body, Controller, Post, Req, UseGuards, UsePipes } from '@nestjs/common'
import { z } from 'zod'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import {
  RequirePermission,
  RoleGuard,
} from '../../../../../common/guards/role.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { CreateLoanSchema } from '../../../../../common/shared-schemas'
import { LoanService } from '../../../application/loan.service'

type CreateLoanBody = z.infer<typeof CreateLoanSchema>

/**
 * A route of its own rather than a flag on transfers.
 *
 * The household is doing a distinct thing — taking on a debt — and the
 * interface should not ask them to know that the ledger records it as a
 * movement between two accounts. The mechanism is an implementation detail;
 * the meaning is not.
 */
@Controller('loans')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class LoansController {
  constructor(private readonly loanService: LoanService) {}

  @Post()
  @RequirePermission('debt:write')
  @UsePipes(new ZodValidationPipe(CreateLoanSchema))
  async recordLoan(@Req() req: RequestContext, @Body() body: CreateLoanBody) {
    const result = await this.loanService.recordLoan({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      lenderAccountId: body.lenderAccountId,
      destinationAccountId: body.destinationAccountId,
      amountMinor: body.amountMinor,
      description: body.description,
      occurredAt: body.occurredAt,
    })

    return { data: result }
  }
}
