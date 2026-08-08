import { Body, Controller, Post, UseGuards, UsePipes } from '@nestjs/common'
import { z } from 'zod'
import { InternalKeyGuard } from '../../../../../common/guards/internal-key.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { GenerateObligationsSchema } from '../../../../../common/shared-schemas'
import { ObligationGenerationService } from '../../../application/obligation-generation.service'

type GenerateObligationsBody = z.infer<typeof GenerateObligationsSchema>

/**
 * System endpoint that materializes obligations across all tenants. Invoked by
 * an external scheduler/worker (see ADR 0006), not by a user session, so it is
 * guarded by the internal key rather than the auth/tenant/role guard chain —
 * the same shape as POST /api/internal/recurring/execute.
 */
@Controller('internal/obligations')
@UseGuards(InternalKeyGuard)
export class ObligationGenerationController {
  constructor(private readonly generationService: ObligationGenerationService) {}

  @Post('generate')
  @UsePipes(new ZodValidationPipe(GenerateObligationsSchema))
  async generate(@Body() body: GenerateObligationsBody) {
    const result = await this.generationService.generate({
      period: body.period,
      horizonMonths: body.horizonMonths,
    })

    return { data: result }
  }
}
