import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { z } from 'zod'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import { RequirePermission, RoleGuard } from '../../../../../common/guards/role.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import {
  CreateCreditLineSchema,
  UpdateCreditLineSchema,
  CreateCreditLineStatementSchema,
  UpdateCreditLineStatementSchema,
} from '../../../../../common/shared-schemas'
import { CreditLineService } from '../../../application/credit-line.service'
import {
  CreditLineStatementService,
  CreditLineStatementView,
  CreditLineWithLatestStatement,
} from '../../../application/credit-line-statement.service'

type CreateCreditLineBody = z.infer<typeof CreateCreditLineSchema>
type UpdateCreditLineBody = z.infer<typeof UpdateCreditLineSchema>
type CreateStatementBody = z.infer<typeof CreateCreditLineStatementSchema>
type UpdateStatementBody = z.infer<typeof UpdateCreditLineStatementSchema>

/** Flattens the derived figure into the shape the contract publishes. */
function toStatementDto(view: CreditLineStatementView) {
  return { ...view.statement, availableMinor: view.availableMinor }
}

function toBoardDto(row: CreditLineWithLatestStatement) {
  return {
    ...row.line,
    latestStatement: row.latestStatement
      ? { ...row.latestStatement, availableMinor: row.availableMinor as number }
      : null,
    availableMinor: row.availableMinor,
  }
}

@Controller('credit-lines')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class CreditLinesController {
  constructor(
    private readonly creditLineService: CreditLineService,
    private readonly statementService: CreditLineStatementService,
  ) {}

  @Get()
  @RequirePermission('credit:read')
  async listCreditLines(@Req() req: RequestContext) {
    const creditLines = await this.creditLineService.listLines(req.tenantId as string)

    return { data: { creditLines } }
  }

  /**
   * Declared before the parameterized routes so `summary` is never captured as
   * a credit-line id — the same ordering hazard the obligations and debts
   * controllers guard against.
   */
  @Get('summary')
  @RequirePermission('credit:read')
  async summary(@Req() req: RequestContext) {
    const rows = await this.statementService.listLinesWithLatestStatement(
      req.tenantId as string,
    )

    return { data: { creditLines: rows.map(toBoardDto) } }
  }

  @Get(':id')
  @RequirePermission('credit:read')
  async getCreditLine(@Req() req: RequestContext, @Param('id') id: string) {
    const creditLine = await this.creditLineService.getLine(id, req.tenantId as string)

    return { data: { creditLine } }
  }

  @Post()
  @RequirePermission('credit:write')
  @UsePipes(new ZodValidationPipe(CreateCreditLineSchema))
  async createCreditLine(@Req() req: RequestContext, @Body() body: CreateCreditLineBody) {
    const creditLine = await this.creditLineService.createLine({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      name: body.name,
      limitMinor: body.limitMinor,
      currency: body.currency,
    })

    return { data: { creditLine } }
  }

  /**
   * Name and limit. Currency is not editable: the statements below a line
   * carry their own amounts, and redenominating above them would reinterpret
   * every one of those figures without touching a digit.
   */
  @Patch(':id')
  @RequirePermission('credit:write')
  @UsePipes(new ZodValidationPipe(UpdateCreditLineSchema))
  async updateCreditLine(
    @Req() req: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateCreditLineBody,
  ) {
    const creditLine = await this.creditLineService.updateLine({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      id,
      name: body.name,
      limitMinor: body.limitMinor,
    })

    return { data: { creditLine } }
  }

  /**
   * Closed, not deleted — the statements it issued stay readable, and so do
   * the payments that settled them.
   */
  @Post(':id/close')
  @RequirePermission('credit:write')
  async closeCreditLine(@Req() req: RequestContext, @Param('id') id: string) {
    const creditLine = await this.creditLineService.closeLine({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      id,
    })

    return { data: { creditLine } }
  }

  @Get(':id/statements')
  @RequirePermission('credit:read')
  async listStatements(@Req() req: RequestContext, @Param('id') id: string) {
    const views = await this.statementService.listStatements(id, req.tenantId as string)

    return { data: { statements: views.map(toStatementDto) } }
  }

  /**
   * Recording a statement materializes the obligation it demands, so the bill
   * reaches the household's board without a second step to remember. The two
   * writes are atomic.
   */
  @Post(':id/statements')
  @RequirePermission('credit:write')
  async recordStatement(
    @Req() req: RequestContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateCreditLineStatementSchema))
    body: CreateStatementBody,
  ) {
    const view = await this.statementService.recordStatement({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      creditLineId: id,
      cutoffDate: body.cutoffDate,
      dueDate: body.dueDate,
      closingBalanceMinor: body.closingBalanceMinor,
      amountDueMinor: body.amountDueMinor,
    })

    return { data: { statement: toStatementDto(view) } }
  }

  /**
   * Correcting a statement corrects its obligation, unlike a recurring rule
   * whose amount is snapshotted into each instance. A statement and its
   * obligation are one fact recorded once.
   */
  @Patch(':id/statements/:statementId')
  @RequirePermission('credit:write')
  async updateStatement(
    @Req() req: RequestContext,
    @Param('statementId') statementId: string,
    @Body(new ZodValidationPipe(UpdateCreditLineStatementSchema))
    body: UpdateStatementBody,
  ) {
    const view = await this.statementService.updateStatement({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      id: statementId,
      dueDate: body.dueDate,
      closingBalanceMinor: body.closingBalanceMinor,
      amountDueMinor: body.amountDueMinor,
    })

    return { data: { statement: toStatementDto(view) } }
  }
}
