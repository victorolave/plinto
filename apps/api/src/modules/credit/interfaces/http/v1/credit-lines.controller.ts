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
} from '../../../../../common/shared-schemas'
import { CreditLineService } from '../../../application/credit-line.service'

type CreateCreditLineBody = z.infer<typeof CreateCreditLineSchema>
type UpdateCreditLineBody = z.infer<typeof UpdateCreditLineSchema>

@Controller('credit-lines')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class CreditLinesController {
  constructor(private readonly creditLineService: CreditLineService) {}

  @Get()
  @RequirePermission('credit:read')
  async listCreditLines(@Req() req: RequestContext) {
    const creditLines = await this.creditLineService.listLines(req.tenantId as string)

    return { data: { creditLines } }
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
}
