import { describe, expect, it } from 'vitest';
import nextConfig, { securityHeaders } from '@/../next.config';

describe('Application Security Headers Configuration', () => {
  it('defines all required security headers', () => {
    const keys = securityHeaders.map((h) => h.key);
    expect(keys).toContain('X-Content-Type-Options');
    expect(keys).toContain('X-Frame-Options');
    expect(keys).toContain('Referrer-Policy');
    expect(keys).toContain('Permissions-Policy');
    expect(keys).toContain('Content-Security-Policy');

    const nosniff = securityHeaders.find((h) => h.key === 'X-Content-Type-Options');
    expect(nosniff?.value).toBe('nosniff');

    const frameOptions = securityHeaders.find((h) => h.key === 'X-Frame-Options');
    expect(frameOptions?.value).toBe('DENY');

    const csp = securityHeaders.find((h) => h.key === 'Content-Security-Policy');
    expect(csp?.value).toContain("default-src 'self'");
    expect(csp?.value).toContain("frame-ancestors 'none'");
    expect(csp?.value).toContain("object-src 'none'");
    expect(csp?.value).toContain("base-uri 'self'");
    expect(csp?.value).toContain("form-action 'self'");
  });

  it('configures nextConfig headers route mapping for all paths', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    if (nextConfig.headers) {
      const routes = await nextConfig.headers();
      expect(routes).toHaveLength(1);
      expect(routes[0]?.source).toBe('/:path*');
      expect(routes[0]?.headers).toBeDefined();
    }
  });
});
