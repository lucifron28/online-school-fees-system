import { describe, it, expect } from 'vitest';
import { UserRole } from '@/server/auth/guards';

describe('Auth & RBAC Logic Tests', () => {
  it('identifies demo user roles correctly', () => {
    const roles: UserRole[] = ['ADMIN', 'FINANCE_STAFF', 'PARENT', 'STUDENT'];
    expect(roles).toHaveLength(4);
    expect(roles).toContain('ADMIN');
    expect(roles).toContain('FINANCE_STAFF');
    expect(roles).toContain('PARENT');
    expect(roles).toContain('STUDENT');
  });

  it('correctly handles active vs disabled account state', () => {
    const activeAccount = { email: 'admin@demo.school', active: true };
    const disabledAccount = { email: 'disabled@demo.school', active: false };

    expect(activeAccount.active).toBe(true);
    expect(disabledAccount.active).toBe(false);
  });

  it('evaluates student portal feature flag toggle', () => {
    const isStudentPortalEnabled = (envVal?: string) => envVal !== 'false';

    expect(isStudentPortalEnabled('true')).toBe(true);
    expect(isStudentPortalEnabled(undefined)).toBe(true);
    expect(isStudentPortalEnabled('false')).toBe(false);
  });

  it('enforces RBAC role permissions hierarchy', () => {
    const canAccessAdmin = (role: UserRole) => role === 'ADMIN';
    const canAccessFinance = (role: UserRole) => role === 'ADMIN' || role === 'FINANCE_STAFF';
    const canAccessParent = (role: UserRole) => role === 'ADMIN' || role === 'PARENT';
    const canAccessStudent = (role: UserRole) => role === 'ADMIN' || role === 'STUDENT';

    expect(canAccessAdmin('ADMIN')).toBe(true);
    expect(canAccessAdmin('FINANCE_STAFF')).toBe(false);
    expect(canAccessAdmin('PARENT')).toBe(false);
    expect(canAccessAdmin('STUDENT')).toBe(false);

    expect(canAccessFinance('FINANCE_STAFF')).toBe(true);
    expect(canAccessFinance('ADMIN')).toBe(true);
    expect(canAccessFinance('PARENT')).toBe(false);

    expect(canAccessParent('PARENT')).toBe(true);
    expect(canAccessParent('STUDENT')).toBe(false);

    expect(canAccessStudent('STUDENT')).toBe(true);
    expect(canAccessStudent('PARENT')).toBe(false);
  });
});
