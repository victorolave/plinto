import { MembershipRole } from '../../modules/memberships/domain/membership.entity'

export type Permission =
  | 'tenant:manage'
  | 'member:invite'
  | 'member:remove'
  | 'member:change-role'
  | 'account:write'
  | 'account:read'
  | 'transaction:write'
  | 'transaction:read'
  | 'report:read'

// Map roles to allowed permissions
const ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  owner: [
    'tenant:manage',
    'member:invite',
    'member:remove',
    'member:change-role',
    'account:write',
    'account:read',
    'transaction:write',
    'transaction:read',
    'report:read',
  ],
  member: [
    'account:write',
    'account:read',
    'transaction:write',
    'transaction:read',
    'report:read',
  ],
  viewer: [
    'account:read',
    'transaction:read',
    'report:read',
  ],
}

export class AuthorizationPolicy {
  static hasPermission(role: MembershipRole, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[role] || []
    return permissions.includes(permission)
  }

  static getAllowedPermissions(role: MembershipRole): Permission[] {
    return ROLE_PERMISSIONS[role] || []
  }

  static requirePermission(role: MembershipRole, permission: Permission): void {
    if (!this.hasPermission(role, permission)) {
      throw new Error(`Role ${role} does not have permission ${permission}`)
    }
  }
}

