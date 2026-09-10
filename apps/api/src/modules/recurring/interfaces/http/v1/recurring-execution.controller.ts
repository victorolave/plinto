import { Body, Controller, Post, UseGuards, UsePipes } from '@nestjs/common'
import { z } from 'zod'
import { InternalKeyGuard } from '../../../../../common/guards/internal-key.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { RecurringExecutionService } from '../../../application/recurring-execution.service'

/**
 * System endpoint that runs due recurring rules across all tenants. Invoked by
 * an external scheduler/worker (see ADR 0006), not by a user session, so it is
 * guarded by the internal key rather than the auth/tenant/role guard chain.
 */
export const ExecuteRecurringSchema = z.object({
  dueDate: z.string().datetime().optional(),
  jobId: z.string().min(1).optional(),
})

type ExecuteRecurringBody = z.infer<typeof ExecuteRecurringSchema>

@Controller('internal/recurring')
@UseGuards(InternalKeyGuard)
export class RecurringExecutionController {
  constructor(private readonly recurringExecutionService: RecurringExecutionService) {}

  @Post('execute')
  @UsePipes(new ZodValidationPipe(ExecuteRecurringSchema))
  async execute(@Body() body: ExecuteRecurringBody) {
    const result = await this.recurringExecutionService.executeDue({
      dueDate: body.dueDate ?? new Date(),
      jobId: body.jobId,
    })

    return { data: result }
  }
}
