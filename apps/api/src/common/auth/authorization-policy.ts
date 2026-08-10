import { MembershipRole } from '../../modules/memberships/domain/membership.entity'

export type Permission =
  | 'tenant:select'
  | 'tenant:manage'
  // Reading the member list is granted to every role, including viewer: a
  // household is a shared context, and "who else is in here" is part of
  // understanding whose money the numbers describe. Only mutating membership
  // is restricted to the owner.
  | 'member:read'
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
  | 'obligation:read'
  | 'obligation:write'
  // What the household owes. Granted on the same lines as obligations: a
  // viewer sees the debt, an owner and a member record and settle it.
  | 'debt:read'
  | 'debt:write'
  // Revolving credit: cards and rotating lines, and the statements they issue.
  // Separate from `debt:*` because a credit line is not an account and not a
  // schedule, so a household could plausibly want one visible and not the
  // other. Granted on the same lines for now.
  | 'credit:read'
  | 'credit:write'

// Map roles to allowed permissions
const ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  owner: [
    'tenant:select',
    'tenant:manage',
    'member:read',
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
    'obligation:read',
    'obligation:write',
    'debt:read',
    'debt:write',
    'credit:read',
    'credit:write',
  ],
  member: [
    'tenant:select',
    'member:read',
    'account:write',
    'account:read',
    'account:delete',
    'transaction:write',
    'transaction:read',
    'report:read',
    'category:read',
    'category:write',
    'obligation:read',
    'obligation:write',
    'debt:read',
    'debt:write',
    'credit:read',
    'credit:write',
  ],
  viewer: [
    'tenant:select',
    'member:read',
    'account:read',
    'transaction:read',
    'report:read',
    'category:read',
    'obligation:read',
    'debt:read',
    'credit:read',
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
