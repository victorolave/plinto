import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  CreateTransferSchema,
  PaginationQuerySchema,
} from '../../../../../common/shared-schemas'
import { TransactionService } from '../../../application/transaction.service'

type CreateTransactionBody = z.infer<typeof CreateTransactionSchema>
type UpdateTransactionBody = z.infer<typeof UpdateTransactionSchema>
type CreateTransferBody = z.infer<typeof CreateTransferSchema>

@Controller('transactions')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class TransactionsController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @RequirePermission('transaction:read')
  async listTransactions(
    @Req() req: RequestContext,
    @Query('accountId') accountId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: parsedPage, pageSize: parsedPageSize } = new ZodValidationPipe(
      PaginationQuerySchema,
    ).transform({ page, pageSize })

    const { transactions, total } = await this.transactionService.listTransactions(
      req.tenantId as string,
      { accountId, page: parsedPage, pageSize: parsedPageSize },
    )

    return {
      data: { transactions },
      meta: {
        pagination: {
          page: parsedPage,
          pageSize: parsedPageSize,
          total,
          totalPages: Math.ceil(total / parsedPageSize),
        },
      },
    }
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
      categoryId: body.categoryId,
    })
    return { data: { transaction } }
  }

  @Post('transfers')
  @RequirePermission('transaction:write')
  async createTransfer(
    @Req() req: RequestContext,
    @Body(new ZodValidationPipe(CreateTransferSchema)) body: CreateTransferBody,
  ) {
    const result = await this.transactionService.createTransfer({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      sourceAccountId: body.sourceAccountId,
      destinationAccountId: body.destinationAccountId,
      sourceAmountMinor: body.sourceAmountMinor,
      destinationAmountMinor: body.destinationAmountMinor,
      fxRate: body.fxRate,
      feeMinor: body.feeMinor,
      description: body.description,
      occurredAt: body.occurredAt,
    })
    return { data: result }
  }

  @Patch(':id')
  @RequirePermission('transaction:write')
  async updateTransaction(
    @Req() req: RequestContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTransactionSchema)) body: UpdateTransactionBody,
  ) {
    const transaction = await this.transactionService.updateTransaction({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      requestId: req.requestId ?? 'unknown',
      transactionId: id,
      accountId: body.accountId,
      type: body.type,
      amountMinor: body.amountMinor,
      description: body.description,
      occurredAt: body.occurredAt,
      categoryId: body.categoryId,
    })
    return { data: { transaction } }
  }
}
