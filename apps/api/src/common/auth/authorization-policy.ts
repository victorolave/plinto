import { MembershipRole } from '../../modules/memberships/domain/membership.entity'

export type Permission =
  | 'tenant:select'
  | 'tenant:manage'
  | 'member:invite'
  | 'member:remove'
  | 'member:change-role'
  | 'account:write'
  | 'account:read'
  | 'account:delete'
  | 'transaction:write'
  | 'transaction:read'
  | 'report:read'
  | 'category:read'
  | 'category:write'

// Map roles to allowed permissions
const ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  owner: [
    'tenant:select',
    'tenant:manage',
    'member:invite',
    'member:remove',
    'member:change-role',
    'account:write',
    'account:read',
    'account:delete',
    'transaction:write',
    'transaction:read',
    'report:read',
    'category:read',
    'category:write',
  ],
  member: [
    'tenant:select',
    'account:write',
    'account:read',
    'account:delete',
    'transaction:write',
    'transaction:read',
    'report:read',
    'category:read',
    'category:write',
  ],
  viewer: [
    'tenant:select',
    'account:read',
    'transaction:read',
    'report:read',
    'category:read',
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
