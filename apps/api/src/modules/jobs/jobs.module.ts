import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { ObligationsModule } from '../obligations/obligations.module'
import { RecurringModule } from '../recurring/recurring.module'
import { ScheduledJobsService } from './application/scheduled-jobs.service'

/**
 * Wires the in-process scheduler (ADR 0006 amendment). `ScheduleModule` gives
 * us `SchedulerRegistry`; the two feature modules give us the same services
 * the internal HTTP endpoints call, so the scheduled path and the manual
 * path always run identical logic.
 */
@Module({
  imports: [ScheduleModule.forRoot(), ObligationsModule, RecurringModule],
  providers: [ScheduledJobsService],
})
export class JobsModule {}
