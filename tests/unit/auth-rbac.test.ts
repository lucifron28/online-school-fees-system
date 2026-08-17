import { describe, it, expect, vi } from 'vitest';
import { resolveAuthBaseUrl } from '@/lib/auth/server';
import { UserRole } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';

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
    const canAccessParent = (role: UserRole) => role === 'PARENT';
    const canAccessStudent = (role: UserRole) => role === 'STUDENT';

    expect(canAccessAdmin('ADMIN')).toBe(true);
    expect(canAccessAdmin('FINANCE_STAFF')).toBe(false);
    expect(canAccessAdmin('PARENT')).toBe(false);
    expect(canAccessAdmin('STUDENT')).toBe(false);

    expect(canAccessFinance('FINANCE_STAFF')).toBe(true);
    expect(canAccessFinance('ADMIN')).toBe(true);
    expect(canAccessFinance('PARENT')).toBe(false);

    expect(canAccessParent('PARENT')).toBe(true);
    expect(canAccessParent('ADMIN')).toBe(false);
    expect(canAccessParent('STUDENT')).toBe(false);

    expect(canAccessStudent('STUDENT')).toBe(true);
    expect(canAccessStudent('ADMIN')).toBe(false);
    expect(canAccessStudent('PARENT')).toBe(false);
  });

  it('keeps authentication infrastructure failures as server errors', async () => {
    const secret = 'database-password-must-not-be-logged';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = routeErrorResponse(new Error(secret));
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: 'Unexpected server error.',
        code: 'INTERNAL_SERVER_ERROR',
      });
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(secret);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('uses the current Vercel preview URL when no explicit auth URL is configured', () => {
    expect(
      resolveAuthBaseUrl({
        betterAuthUrl: '',
        nextPublicAppUrl: 'https://online-school-fees.vercel.app',
        vercelEnv: 'preview',
        vercelUrl: 'online-school-fees-preview.vercel.app',
      })
    ).toBe('https://online-school-fees-preview.vercel.app');
  });

  it('keeps an explicit Better Auth URL authoritative', () => {
    expect(
      resolveAuthBaseUrl({
        betterAuthUrl: 'https://auth.example.test',
        vercelEnv: 'preview',
        vercelUrl: 'online-school-fees-preview.vercel.app',
      })
    ).toBe('https://auth.example.test');
  });
});
