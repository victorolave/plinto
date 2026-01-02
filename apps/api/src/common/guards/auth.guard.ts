import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { SESSION_COOKIE_NAME } from '../../config/constants'
import { SessionRepository } from '../../modules/sessions/infrastructure/session.repository'
import { readCookie } from '../utils/cookies'
import { RequestContext } from '../types/request-context'
import { JwtService } from '../auth/jwt.service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<RequestContext>()
    const cookieHeader = req.headers.cookie
    const jwtToken = readCookie(cookieHeader, SESSION_COOKIE_NAME)

    if (!jwtToken) {
      throw new UnauthorizedException('Authentication required')
    }

    // Validate JWT token
    let payload
    try {
      payload = this.jwtService.verify(jwtToken)
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token')
    }

    // Verify session is still active and not revoked
    const session = await this.sessionRepository.findActiveById(payload.session_id)
    if (!session) {
      throw new UnauthorizedException('Session expired or revoked')
    }

    // Set request context
    req.sessionId = session.id
    req.user = { 
      id: payload.sub,
      idpSub: payload.idp_sub,
    }
    req.tenantId = payload.tenant_id ?? null

    return true
  }
}
