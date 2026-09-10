import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScheduledJobsService } from '../scheduled-jobs.service'

const makeConfigService = (overrides: Record<string, unknown> = {}) => {
  const values: Record<string, unknown> = {
    'jobs.schedulerEnabled': false,
    'jobs.cron': '0 6 * * *',
    'jobs.timezone': 'America/Bogota',
    'jobs.horizonMonths': 3,
    ...overrides,
  }
  return { get: vi.fn((key: string) => values[key]) }
}

const makeSchedulerRegistry = () => ({
  addCronJob: vi.fn(),
})

describe('ScheduledJobsService', () => {
  let configService: ReturnType<typeof makeConfigService>
  let schedulerRegistry: ReturnType<typeof makeSchedulerRegistry>
  let obligationGenerationService: { generate: ReturnType<typeof vi.fn> }
  let recurringExecutionService: { executeDue: ReturnType<typeof vi.fn> }
  let service: ScheduledJobsService

  beforeEach(() => {
    schedulerRegistry = makeSchedulerRegistry()
    obligationGenerationService = {
      generate: vi.fn().mockResolvedValue({ created: 1, skipped: 0, periods: ['2026-09'] }),
    }
    recurringExecutionService = {
      executeDue: vi.fn().mockResolvedValue({ created: 1, skipped: 0 }),
    }
  })

  describe('onModuleInit', () => {
    it('does not register a cron job when the scheduler is disabled', () => {
      configService = makeConfigService({ 'jobs.schedulerEnabled': false })
      service = new ScheduledJobsService(
        configService as any,
        schedulerRegistry as any,
        obligationGenerationService as any,
        recurringExecutionService as any,
      )

      service.onModuleInit()

      expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled()
      expect(obligationGenerationService.generate).not.toHaveBeenCalled()
      expect(recurringExecutionService.executeDue).not.toHaveBeenCalled()
    })

    it('registers a cron job through SchedulerRegistry when enabled', () => {
      configService = makeConfigService({ 'jobs.schedulerEnabled': true })
      service = new ScheduledJobsService(
        configService as any,
        schedulerRegistry as any,
        obligationGenerationService as any,
        recurringExecutionService as any,
      )

      service.onModuleInit()

      expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(1)
      const [name, job] = schedulerRegistry.addCronJob.mock.calls[0]
      expect(name).toBe('scheduled-jobs.run-due-work')
      expect(job).toBeDefined()
    })

    it('throws a clear error at init when JOBS_CRON is invalid and the scheduler is enabled', () => {
      configService = makeConfigService({
        'jobs.schedulerEnabled': true,
        'jobs.cron': 'not a cron expression',
      })
      service = new ScheduledJobsService(
        configService as any,
        schedulerRegistry as any,
        obligationGenerationService as any,
        recurringExecutionService as any,
      )

      expect(() => service.onModuleInit()).toThrow(/Invalid JOBS_CRON expression/)
      expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled()
    })
  })

  describe('runOnce', () => {
    beforeEach(() => {
      configService = makeConfigService({ 'jobs.horizonMonths': 3 })
      service = new ScheduledJobsService(
        configService as any,
        schedulerRegistry as any,
        obligationGenerationService as any,
        recurringExecutionService as any,
      )
    })

    it('generates obligations before executing due recurring rules, with the expected args', async () => {
      const now = new Date('2026-09-02T11:00:00.000Z')

      await service.runOnce(now)

      expect(obligationGenerationService.generate).toHaveBeenCalledWith({
        horizonMonths: 3,
        now,
      })
      expect(recurringExecutionService.executeDue).toHaveBeenCalledWith({
        dueDate: now,
        jobId: `scheduler-${now.toISOString()}`,
      })

      const generateOrder = obligationGenerationService.generate.mock.invocationCallOrder[0]
      const executeOrder = recurringExecutionService.executeDue.mock.invocationCallOrder[0]
      expect(generateOrder).toBeLessThan(executeOrder)
    })

    it('skips an overlapping tick while a previous run is still in progress', async () => {
      let resolveGenerate: (value: { created: number; skipped: number; periods: string[] }) => void =
        () => undefined
      obligationGenerationService.generate.mockReturnValue(
        new Promise((resolve) => {
          resolveGenerate = resolve
        }),
      )

      const firstRun = service.runOnce(new Date('2026-09-02T11:00:00.000Z'))
      const secondRun = service.runOnce(new Date('2026-09-02T11:00:01.000Z'))

      resolveGenerate({ created: 0, skipped: 0, periods: [] })
      await Promise.all([firstRun, secondRun])

      expect(obligationGenerationService.generate).toHaveBeenCalledTimes(1)
      expect(recurringExecutionService.executeDue).toHaveBeenCalledTimes(1)
    })

    it('allows a new tick once the previous one has finished', async () => {
      await service.runOnce(new Date('2026-09-02T11:00:00.000Z'))
      await service.runOnce(new Date('2026-09-02T11:00:01.000Z'))

      expect(obligationGenerationService.generate).toHaveBeenCalledTimes(2)
      expect(recurringExecutionService.executeDue).toHaveBeenCalledTimes(2)
    })

    it('logs and swallows a failing generate without calling executeDue', async () => {
      obligationGenerationService.generate.mockRejectedValue(new Error('db unavailable'))

      await expect(service.runOnce(new Date('2026-09-02T11:00:00.000Z'))).resolves.toBeUndefined()

      expect(recurringExecutionService.executeDue).not.toHaveBeenCalled()
    })

    it('releases the in-flight flag after a failing tick, so the next tick can run', async () => {
      obligationGenerationService.generate.mockRejectedValueOnce(new Error('db unavailable'))

      await service.runOnce(new Date('2026-09-02T11:00:00.000Z'))
      await service.runOnce(new Date('2026-09-02T11:00:01.000Z'))

      expect(obligationGenerationService.generate).toHaveBeenCalledTimes(2)
      expect(recurringExecutionService.executeDue).toHaveBeenCalledTimes(1)
    })
  })
})
