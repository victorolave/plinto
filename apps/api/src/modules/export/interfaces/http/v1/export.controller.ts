import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import { RequirePermission, RoleGuard } from '../../../../../common/guards/role.guard'
import { HouseholdExportService } from '../../../application/household-export.service'

/**
 * "Your data is yours": the whole household as a JSON bundle, or its
 * transaction ledger as CSV. Both require `tenant:export` (owner only — see
 * authorization-policy.ts) because this is a full data dump, not a read of
 * one screen's worth of numbers.
 *
 * Both handlers build the entire response body — including the audit write
 * — before touching `res` at all. The global HttpExceptionFilter answers
 * every route with a JSON error envelope, which is incompatible with a file
 * download's headers; using `@Res()` (library-specific mode) here means we
 * own the response, and only reach for it once the service call has fully
 * succeeded, so a failure partway through never leaves a half-written
 * attachment on the wire — it falls through to the filter exactly like any
 * other endpoint.
 */
@Controller('export')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class ExportController {
  constructor(private readonly exportService: HouseholdExportService) {}

  @Get('household')
  @RequirePermission('tenant:export')
  async exportHousehold(@Req() req: RequestContext, @Res() res: Response): Promise<void> {
    const { json, filename } = await this.exportService.exportHousehold({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
    })

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(json)
  }

  @Get('transactions.csv')
  @RequirePermission('tenant:export')
  async exportTransactionsCsv(
    @Req() req: RequestContext,
    @Res() res: Response,
  ): Promise<void> {
    const { csv, filename } = await this.exportService.exportTransactionsCsv({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(csv)
  }
}
