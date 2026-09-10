import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { timingSafeEqual } from 'node:crypto'
import { RequestContext } from '../types/request-context'

/**
 * Constant-time string comparison. Returns false for mismatched lengths without
 * calling timingSafeEqual (which throws on unequal-length buffers); the length
 * check is not itself a meaningful side channel for a random key.
 */
function safeKeyEqual(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)
  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }
  return timingSafeEqual(providedBuffer, expectedBuffer)
}

/**
 * Guards system-to-system endpoints (schedulers, workers, other trusted
 * services) with the shared `INTERNAL_API_KEY`. These endpoints are not tied to
 * a user session or tenant, so they bypass AuthGuard/TenantGuard/RoleGuard and
 * rely solely on the internal key presented in the `x-internal-key` header.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestContext>()
    const header = req.headers['x-internal-key']
    const providedKey = Array.isArray(header) ? header[0] : header
    const expectedKey = this.configService.get<string>('internalApiKey')

    if (!expectedKey || !providedKey || !safeKeyEqual(providedKey, expectedKey)) {
      throw new UnauthorizedException('Invalid internal key')
    }

    return true
  }
}
