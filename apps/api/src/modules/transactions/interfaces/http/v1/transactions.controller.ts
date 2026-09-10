import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import type { Response } from 'express'
import { z } from 'zod'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import {
  RequirePermission,
  RoleGuard,
} from '../../../../../common/guards/role.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { IdempotencyKeyPipe } from '../../../../../common/pipes/idempotency-key.pipe'
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  CreateTransferSchema,
  TransactionListQuerySchema,
  type TransactionListQuery,
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
    // The whole query object rather than one parameter per filter: the ledger
    // is narrowed five ways now, and a positional signature would grow a
    // parameter every time a filter is added while telling the reader nothing
    // about which are optional or how they are parsed.
    @Query() query: Record<string, string | undefined>,
  ) {
    const { page, pageSize, ...filters } = new ZodValidationPipe(
      TransactionListQuerySchema,
    ).transform(query) as TransactionListQuery

    const { transactions, total, counts } = await this.transactionService.listTransactions(
      req.tenantId as string,
      { ...filters, page, pageSize },
    )

    return {
      data: { transactions },
      meta: {
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        // For the income/expense tabs. Whole-set figures, not this page's:
        // the tabs set the type filter, so per-page counts would rewrite the
        // labels every time the reader turned a page.
        counts,
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

  /**
   * `Idempotency-Key` is an optional request header, not a body field — kept
   * separate from `Transaction.idempotencyKey` / recurring execution's
   * idempotency key, which the recurring engine generates for itself. Absent,
   * behaviour is unchanged and this always responds `201`. Present and
   * repeated with the same key for this tenant, no second transfer is
   * created: the original is returned with `200` instead.
   *
   * `@Headers()` in this Nest version has no pipe-applying overload (unlike
   * `@Body`/`@Query`/`@Param`), so `IdempotencyKeyPipe` is applied by hand to
   * the raw header rather than declared on the decorator.
   */
  @Post('transfers')
  @RequirePermission('transaction:write')
  async createTransfer(
    @Req() req: RequestContext,
    @Body(new ZodValidationPipe(CreateTransferSchema)) body: CreateTransferBody,
    @Headers('idempotency-key') rawIdempotencyKey: string | string[] | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const idempotencyKey = new IdempotencyKeyPipe().transform(rawIdempotencyKey)
    const { alreadyExisted, ...result } = await this.transactionService.createTransfer({
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
      idempotencyKey,
    })
    res.status(alreadyExisted ? 200 : 201)
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
