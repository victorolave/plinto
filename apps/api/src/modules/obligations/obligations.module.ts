import { Module } from '@nestjs/common'
import { RecurringModule } from '../recurring/recurring.module'
import { InternalKeyGuard } from '../../common/guards/internal-key.guard'
import { ObligationGenerationService } from './application/obligation-generation.service'
import { ObligationRepository } from './domain/obligation.repository'
import { PrismaObligationRepository } from './infrastructure/prisma-obligation.repository'
import { ObligationGenerationController } from './interfaces/http/v1/obligation-generation.controller'

@Module({
  // RecurringModule exports its repository port, which generation reads to find
  // the active rules a period must materialize.
  imports: [RecurringModule],
  controllers: [ObligationGenerationController],
  providers: [
    ObligationGenerationService,
    { provide: ObligationRepository, useClass: PrismaObligationRepository },
    InternalKeyGuard,
  ],
  exports: [ObligationGenerationService, ObligationRepository],
})
export class ObligationsModule {}
