import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { RecurringExecutionController } from '../recurring-execution.controller'

describe('RecurringExecutionController', () => {
  it('delegates to the execution service and wraps the result in a data envelope', async () => {
    const recurringExecutionService = {
      executeDue: vi.fn().mockResolvedValue({ created: 2, skipped: 1 }),
    }
    const controller = new RecurringExecutionController(recurringExecutionService as any)

    const result = await controller.execute({
      dueDate: '2026-07-01T00:00:00.000Z',
      jobId: 'job-42',
    })

    expect(recurringExecutionService.executeDue).toHaveBeenCalledWith({
      dueDate: '2026-07-01T00:00:00.000Z',
      jobId: 'job-42',
    })
    expect(result).toEqual({ data: { created: 2, skipped: 1 } })
  })

  it('defaults dueDate to the current time when the body omits it', async () => {
    const recurringExecutionService = {
      executeDue: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
    }
    const controller = new RecurringExecutionController(recurringExecutionService as any)

    await controller.execute({})

    const callArg = recurringExecutionService.executeDue.mock.calls[0][0]
    expect(callArg.dueDate).toBeInstanceOf(Date)
    expect(callArg.jobId).toBeUndefined()
  })
})
