import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RequestContext } from '../types/request-context'
import { MembershipRepository } from '../../modules/memberships/infrastructure/membership.repository'
import { AuthorizationPolicy, Permission } from '../auth/authorization-policy'

export const PERMISSION_KEY = 'permission'

export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission)

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<Permission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (!requiredPermission) {
      // No permission required, allow access
      return true
    }

    const req = context.switchToHttp().getRequest<RequestContext>()

    if (!req.user?.id || !req.tenantId) {
      throw new ForbiddenException('User and tenant context required')
    }

    const membership = await this.membershipRepository.findByUserAndTenant(
      req.user.id,
      req.tenantId,
    )

    if (!membership) {
      throw new ForbiddenException('Membership not found')
    }

    if (!AuthorizationPolicy.hasPermission(membership.role, requiredPermission)) {
      throw new ForbiddenException(
        `Role ${membership.role} does not have permission ${requiredPermission}`,
      )
    }

    return true
  }
}

