import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { z } from 'zod'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import {
  RequirePermission,
  RoleGuard,
} from '../../../../../common/guards/role.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { CreateTransactionSchema } from '../../../../../common/shared-schemas'
import { TransactionService } from '../../../application/transaction.service'

type CreateTransactionBody = z.infer<typeof CreateTransactionSchema>

@Controller('transactions')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class TransactionsController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @RequirePermission('transaction:read')
  async listTransactions(
    @Req() req: RequestContext,
    @Query('accountId') accountId?: string,
  ) {
    const transactions = await this.transactionService.listTransactions(
      req.tenantId as string,
      accountId,
    )
    return { data: { transactions } }
  }

  @Get('balances')
  @RequirePermission('transaction:read')
  async listBalances(@Req() req: RequestContext) {
    const balances = await this.transactionService.getBalances(
      req.tenantId as string,
    )
    return { data: { balances } }
  }

  @Post()
  @RequirePermission('transaction:write')
  @UsePipes(new ZodValidationPipe(CreateTransactionSchema))
  async createTransaction(
    @Req() req: RequestContext,
    @Body() body: CreateTransactionBody,
  ) {
    const transaction = await this.transactionService.createTransaction({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      requestId: req.requestId ?? 'unknown',
      accountId: body.accountId,
      type: body.type,
      amountMinor: body.amountMinor,
      description: body.description,
      occurredAt: body.occurredAt,
    })
    return { data: { transaction } }
  }
}
