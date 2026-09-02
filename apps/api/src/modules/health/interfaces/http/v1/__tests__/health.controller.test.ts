import { describe, expect, it, vi } from 'vitest'
import { HealthController } from '../health.controller'

const makeResponse = () => ({
  status: vi.fn(),
})

describe('HealthController', () => {
  it('returns 200 with status ok when the database check succeeds', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const controller = new HealthController(prisma as any)
    const res = makeResponse()

    const result = await controller.check(res as any)

    expect(result).toEqual({ status: 'ok', checks: { database: 'up' } })
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 503 with status error when the database check fails', async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error('connection refused')) }
    const controller = new HealthController(prisma as any)
    const res = makeResponse()

    const result = await controller.check(res as any)

    expect(result).toEqual({ status: 'error', checks: { database: 'down' } })
    expect(res.status).toHaveBeenCalledWith(503)
  })
})
