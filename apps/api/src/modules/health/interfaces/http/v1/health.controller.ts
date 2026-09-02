import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import type { Response } from 'express'
import { PrismaService } from '../../../../../infrastructure/database/prisma/prisma.service'

interface HealthResult {
  status: 'ok' | 'error'
  checks: { database: 'up' | 'down' }
}

/**
 * Container/orchestrator health check (ADR 0005 §7). Deliberately not behind
 * AuthGuard or InternalKeyGuard: a load balancer or container runtime probing
 * this endpoint has neither a session cookie nor the internal API key, and
 * there is nothing here worth protecting — a boolean "is the API reachable
 * and can it talk to its database" is not sensitive.
 *
 * No global auth guard is registered in AppModule (guards are applied per
 * module), so this controller is public simply by not opting into one.
 *
 * Responds with a plain `{ status, checks }` body rather than throwing, on
 * both the up and down paths: the global HttpExceptionFilter would otherwise
 * rewrite a thrown error into its `{ error: {...} } }` envelope, which is not
 * the contract a health probe expects. `@Res({ passthrough: true })` only
 * sets the status code; returning the body still runs through Nest's normal
 * serialization.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { status: 'ok', checks: { database: 'up' } }
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE)
      return { status: 'error', checks: { database: 'down' } }
    }
  }
}
