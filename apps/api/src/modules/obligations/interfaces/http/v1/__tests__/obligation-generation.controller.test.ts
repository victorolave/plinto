import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { ObligationGenerationController } from '../obligation-generation.controller'

describe('ObligationGenerationController', () => {
  it('delegates to the generation service and wraps the result in a data envelope', async () => {
    const generationService = {
      generate: vi.fn().mockResolvedValue({
        created: 4,
        skipped: 1,
        periods: ['2026-07'],
      }),
    }
    const controller = new ObligationGenerationController(generationService as any)

    const result = await controller.generate({ period: '2026-07', horizonMonths: 1 })

    expect(generationService.generate).toHaveBeenCalledWith({
      period: '2026-07',
      horizonMonths: 1,
    })
    expect(result).toEqual({
      data: { created: 4, skipped: 1, periods: ['2026-07'] },
    })
  })

  it('passes a forward projection horizon through to the service', async () => {
    const generationService = {
      generate: vi.fn().mockResolvedValue({ created: 0, skipped: 0, periods: [] }),
    }
    const controller = new ObligationGenerationController(generationService as any)

    await controller.generate({ horizonMonths: 6 })

    expect(generationService.generate).toHaveBeenCalledWith({
      period: undefined,
      horizonMonths: 6,
    })
  })
})
