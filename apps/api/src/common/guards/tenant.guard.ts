import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { RequestContext } from '../types/request-context'
import { MembershipRepository } from '../../modules/memberships/infrastructure/membership.repository'
import { SessionService } from '../../modules/sessions/application/session.service'

/**
 * TenantGuard ensures that:
 * 1. User is authenticated (requires AuthGuard to run first)
 * 2. Tenant context is resolved (from header, body, or session)
 * 3. User has active membership in the tenant
 * 
 * Sets req.tenantId for use in controllers and other guards.
 * 
 * IMPORTANT: All endpoints that operate on tenant-scoped data MUST use this guard.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<RequestContext>()
    if (!req.user?.id) {
      throw new UnauthorizedException('Authentication required')
    }

    // Resolve tenant ID from multiple sources (priority order)
    const headerTenantId = req.headers['x-tenant-id']
    const tenantId =
      (Array.isArray(headerTenantId) ? headerTenantId[0] : headerTenantId) ??
      (typeof (req as { body?: { tenantId?: string } }).body?.tenantId === 'string'
        ? (req as { body?: { tenantId?: string } }).body?.tenantId
        : undefined) ??
      req.tenantId ?? // From JWT payload if available
      (await this.sessionService.getActiveTenant(req.user.id))

    if (!tenantId) {
      throw new ForbiddenException('Tenant selection required')
    }

    // Verify user has active membership in tenant
    const isMember = await this.membershipRepository.isMember(
      req.user.id,
      tenantId,
    )

    if (!isMember) {
      throw new ForbiddenException('Tenant access denied')
    }

    // Set tenant context for downstream use
    req.tenantId = tenantId
    return true
  }
}
