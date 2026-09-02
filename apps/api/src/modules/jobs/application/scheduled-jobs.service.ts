import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SchedulerRegistry } from '@nestjs/schedule'
import { CronJob } from 'cron'
import { ObligationGenerationService } from '../../obligations/application/obligation-generation.service'
import { RecurringExecutionService } from '../../recurring/application/recurring-execution.service'

const CRON_JOB_NAME = 'scheduled-jobs.run-due-work'

/**
 * Drives the obligations engine from inside the API process (ADR 0006
 * amendment), instead of relying solely on an external caller of the
 * internal endpoints. Order matters: generation materializes what a period
 * expects before execution posts anything against it, exactly like the
 * GitHub Actions workflow this supersedes for instances that opt in.
 *
 * Disabled by default (`JOBS_SCHEDULER_ENABLED`), so a self-hosted install
 * or a horizontally-scaled deployment does not run the engine on every
 * replica unless someone decides it should — enable it on exactly one
 * instance per environment.
 */
@Injectable()
export class ScheduledJobsService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledJobsService.name)
  private running = false

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly obligationGenerationService: ObligationGenerationService,
    private readonly recurringExecutionService: RecurringExecutionService,
  ) {}

  onModuleInit(): void {
    const enabled = this.configService.get<boolean>('jobs.schedulerEnabled')

    if (!enabled) {
      this.logger.log(
        'In-process scheduler disabled (JOBS_SCHEDULER_ENABLED is not "true"). ' +
          'The obligations engine will only run through the internal endpoints ' +
          '(manual/backfill) or the fallback scheduled-jobs GitHub Actions workflow.',
      )
      return
    }

    const cronExpression = this.configService.get<string>('jobs.cron') ?? ''
    const timezone = this.configService.get<string>('jobs.timezone') ?? ''

    let job: CronJob
    try {
      job = CronJob.from({
        cronTime: cronExpression,
        onTick: () => {
          void this.runOnce()
        },
        start: true,
        timeZone: timezone,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`Invalid JOBS_CRON expression "${cronExpression}": ${reason}`)
    }

    this.schedulerRegistry.addCronJob(CRON_JOB_NAME, job)
    this.logger.log(
      `In-process scheduler enabled: cron="${cronExpression}" timezone="${timezone}"`,
    )
  }

  /**
   * Runs one generation-then-execution cycle. Exposed separately from the
   * cron tick so tests can drive it deterministically, without timers or a
   * real cron schedule.
   *
   * A tick that is still running is skipped rather than queued or run
   * concurrently — a second in-flight run over the same due date would only
   * ever find work the first run already claimed (both operations are
   * idempotent), so overlap buys nothing and risks doubling load on a slow
   * database.
   *
   * Errors are logged and swallowed here deliberately: a failing tick must
   * never crash the API process it shares, and the next scheduled tick (or a
   * manual call to the internal endpoints) gets another chance.
   */
  async runOnce(now: Date = new Date()): Promise<void> {
    if (this.running) {
      this.logger.warn('Skipping scheduled tick: the previous run is still in progress.')
      return
    }

    this.running = true
    const jobId = `scheduler-${now.toISOString()}`
    const horizonMonths = this.configService.get<number>('jobs.horizonMonths')

    try {
      const generated = await this.obligationGenerationService.generate({
        horizonMonths,
        now,
      })
      this.logger.log(
        `Scheduled tick: generated obligations — created=${generated.created} ` +
          `skipped=${generated.skipped} periods=${generated.periods.join(',')}`,
      )

      const executed = await this.recurringExecutionService.executeDue({
        dueDate: now,
        jobId,
      })
      this.logger.log(
        `Scheduled tick: executed recurring rules — created=${executed.created} ` +
          `skipped=${executed.skipped} jobId=${jobId}`,
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Scheduled tick failed: ${reason}`, stack)
    } finally {
      this.running = false
    }
  }
}
