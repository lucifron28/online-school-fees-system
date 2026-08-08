export const USER_ROLES = ['ADMIN', 'FINANCE_STAFF', 'PARENT', 'STUDENT'] as const;

export type UserRole = (typeof USER_ROLES)[number];

const ROLE_LANDING_PATH: Record<UserRole, string> = {
  ADMIN: '/admin/dashboard',
  FINANCE_STAFF: '/admin/dashboard',
  PARENT: '/parent/dashboard',
  STUDENT: '/student/dashboard',
};

const ROLE_LOGIN_PATH: Record<UserRole, string> = {
  ADMIN: '/login/admin',
  FINANCE_STAFF: '/login/admin',
  PARENT: '/login/parent',
  STUDENT: '/login/student',
};

export function parseUserRole(value: unknown): UserRole | null {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole)
    ? (value as UserRole)
    : null;
}

export function getRoleLandingPath(role: UserRole): string {
  return ROLE_LANDING_PATH[role];
}

export function getRoleLoginPath(role: UserRole): string {
  return ROLE_LOGIN_PATH[role];
}
