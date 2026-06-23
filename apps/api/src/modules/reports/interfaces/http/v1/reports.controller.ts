import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import { RequirePermission, RoleGuard } from '../../../../../common/guards/role.guard'
import { ReportService } from '../../../application/report.service'

@Controller('reports')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class ReportsController {
  constructor(private readonly reportService: ReportService) {}

  @Get('expenses-by-category')
  @RequirePermission('report:read')
  async getExpensesByCategory(
    @Req() req: RequestContext,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException({
        code: 'REPORT_INVALID_PERIOD',
        message: 'Both from and to date parameters are required',
      })
    }

    // Parse date-only strings (YYYY-MM-DD) as UTC midnight.
    // `from` stays at start-of-day (00:00:00.000Z — correct for gte).
    // `to` is normalized to end-of-UTC-day (23:59:59.999Z) so that transactions
    // occurring at any point during the final day are included in the lte boundary.
    const fromDate = new Date(`${from}T00:00:00.000Z`)
    const toDate = new Date(`${to}T23:59:59.999Z`)

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException({
        code: 'REPORT_INVALID_PERIOD',
        message: 'Invalid date format for from or to parameter',
      })
    }

    if (fromDate > toDate) {
      // Reversed range — reject with the same error shape used for unparseable dates.
      throw new BadRequestException({
        code: 'REPORT_INVALID_PERIOD',
        message: 'from date must not be after to date',
      })
    }

    const items = await this.reportService.getExpensesByCategory(
      req.tenantId as string,
      fromDate,
      toDate,
    )

    return {
      data: {
        from,
        to,
        items,
      },
    }
  }
}
