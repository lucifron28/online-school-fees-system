import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getClientEnv, getServerEnv } from '@/lib/env';

describe('Environment Variable Parsing and Defaults', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('NEXT_PUBLIC_ENABLE_DEMO_NAV', () => {
    it('defaults to false when undefined', () => {
      delete process.env.NEXT_PUBLIC_ENABLE_DEMO_NAV;
      expect(getClientEnv().NEXT_PUBLIC_ENABLE_DEMO_NAV).toBe(false);
    });

    it('returns false when set to "false"', () => {
      process.env.NEXT_PUBLIC_ENABLE_DEMO_NAV = 'false';
      expect(getClientEnv().NEXT_PUBLIC_ENABLE_DEMO_NAV).toBe(false);
    });

    it('returns false for arbitrary non-"true" strings', () => {
      process.env.NEXT_PUBLIC_ENABLE_DEMO_NAV = '';
      expect(getClientEnv().NEXT_PUBLIC_ENABLE_DEMO_NAV).toBe(false);

      process.env.NEXT_PUBLIC_ENABLE_DEMO_NAV = '0';
      expect(getClientEnv().NEXT_PUBLIC_ENABLE_DEMO_NAV).toBe(false);

      process.env.NEXT_PUBLIC_ENABLE_DEMO_NAV = 'yes';
      expect(getClientEnv().NEXT_PUBLIC_ENABLE_DEMO_NAV).toBe(false);
    });

    it('returns true ONLY when explicitly set to "true"', () => {
      process.env.NEXT_PUBLIC_ENABLE_DEMO_NAV = 'true';
      expect(getClientEnv().NEXT_PUBLIC_ENABLE_DEMO_NAV).toBe(true);
    });
  });

  describe('ENABLE_MOCK_PAYMENT_HARNESS', () => {
    it('defaults to false when undefined', () => {
      delete process.env.ENABLE_MOCK_PAYMENT_HARNESS;
      expect(getServerEnv().ENABLE_MOCK_PAYMENT_HARNESS).toBe(false);
    });

    it('returns false when set to "false"', () => {
      process.env.ENABLE_MOCK_PAYMENT_HARNESS = 'false';
      expect(getServerEnv().ENABLE_MOCK_PAYMENT_HARNESS).toBe(false);
    });

    it('returns true when set to "true"', () => {
      process.env.ENABLE_MOCK_PAYMENT_HARNESS = 'true';
      expect(getServerEnv().ENABLE_MOCK_PAYMENT_HARNESS).toBe(true);
    });
  });
});
