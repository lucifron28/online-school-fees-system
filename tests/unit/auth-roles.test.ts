import { describe, expect, it } from 'vitest';
import {
  getRoleLandingPath,
  getRoleLoginPath,
  parseUserRole,
  type UserRole,
} from '@/lib/auth/roles';

describe('auth role routing', () => {
  it('accepts only persisted roles', () => {
    expect(parseUserRole('ADMIN')).toBe('ADMIN');
    expect(parseUserRole('FINANCE_STAFF')).toBe('FINANCE_STAFF');
    expect(parseUserRole('root')).toBeNull();
    expect(parseUserRole(undefined)).toBeNull();
  });

  it('maps every role to a fixed portal and login path', () => {
    const roles: UserRole[] = ['ADMIN', 'FINANCE_STAFF', 'PARENT', 'STUDENT'];

    expect(roles.map(getRoleLandingPath)).toEqual([
      '/admin/dashboard',
      '/admin/dashboard',
      '/parent/dashboard',
      '/student/dashboard',
    ]);
    expect(roles.map(getRoleLoginPath)).toEqual([
      '/login/admin',
      '/login/admin',
      '/login/parent',
      '/login/student',
    ]);
  });
});
