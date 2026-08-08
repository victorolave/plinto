import {
  Body,
  Controller,
  Delete,
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
  CreateRecurringTransactionRuleSchema,
  UpdateRecurringTransactionRuleSchema,
} from '../../../../../common/shared-schemas'
import { RecurringTransactionService } from '../../../application/recurring-transaction.service'

type CreateRecurringRuleBody = z.infer<typeof CreateRecurringTransactionRuleSchema>
type UpdateRecurringRuleBody = z.infer<typeof UpdateRecurringTransactionRuleSchema>

@Controller('recurring-transactions')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class RecurringTransactionsController {
  constructor(private readonly recurringService: RecurringTransactionService) {}

  @Get()
  @RequirePermission('transaction:read')
  async listRules(
    @Req() req: RequestContext,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const rules = await this.recurringService.listRules(req.tenantId as string, {
      includeArchived: includeArchived === 'true',
    })
    return { data: { rules } }
  }

  @Post()
  @RequirePermission('transaction:write')
  @UsePipes(new ZodValidationPipe(CreateRecurringTransactionRuleSchema))
  async createRule(
    @Req() req: RequestContext,
    @Body() body: CreateRecurringRuleBody,
  ) {
    const rule = await this.recurringService.createRule({
      ...this.contextOf(req),
      name: body.name,
      accountId: body.accountId,
      type: body.type,
      amountMinor: body.amountMinor,
      dayOfMonth: body.dayOfMonth,
      startDate: body.startDate,
      status: body.status,
    })
    return { data: { rule } }
  }

  @Patch(':id')
  @RequirePermission('transaction:write')
  async updateRule(
    @Req() req: RequestContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRecurringTransactionRuleSchema))
    body: UpdateRecurringRuleBody,
  ) {
    const rule = await this.recurringService.updateRule({
      ...this.contextOf(req),
      id,
      name: body.name,
      amountMinor: body.amountMinor,
      dayOfMonth: body.dayOfMonth,
      startDate: body.startDate,
    })
    return { data: { rule } }
  }

  @Post(':id/pause')
  @RequirePermission('transaction:write')
  async pauseRule(@Req() req: RequestContext, @Param('id') id: string) {
    const rule = await this.recurringService.pauseRule({ ...this.contextOf(req), id })
    return { data: { rule } }
  }

  @Post(':id/resume')
  @RequirePermission('transaction:write')
  async resumeRule(@Req() req: RequestContext, @Param('id') id: string) {
    const rule = await this.recurringService.resumeRule({ ...this.contextOf(req), id })
    return { data: { rule } }
  }

  @Post(':id/restore')
  @RequirePermission('transaction:write')
  async restoreRule(@Req() req: RequestContext, @Param('id') id: string) {
    const rule = await this.recurringService.restoreRule({ ...this.contextOf(req), id })
    return { data: { rule } }
  }

  /**
   * Archives rather than deletes: executions reference the rule with
   * ON DELETE RESTRICT and its history must survive (ADR 0008). Kept on
   * DELETE because archiving is what "remove this rule" means here, matching
   * how DELETE /api/accounts/{id} archives an account.
   *
   * Guarded by `transaction:write`, not a dedicated delete permission:
   * retiring a template moves no money and destroys no record, so it is the
   * same class of act as editing one.
   */
  @Delete(':id')
  @RequirePermission('transaction:write')
  async archiveRule(@Req() req: RequestContext, @Param('id') id: string) {
    const rule = await this.recurringService.archiveRule({ ...this.contextOf(req), id })
    return { data: { rule } }
  }

  private contextOf(req: RequestContext) {
    return {
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
    }
  }
}
