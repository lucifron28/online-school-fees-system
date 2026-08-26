import { test, expect } from '@playwright/test';

test.describe('Foundation Application & Scaffold Navigation Smoke Tests', () => {
  test('opens homepage hub and verifies the current workspace map', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        name: 'Keep every fee, payment, and receipt in one clear record.',
      })
    ).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Explore the main views.' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open administrator portal', exact: true })
    ).toHaveAttribute('href', '/login/admin');
    expect(consoleErrors).toEqual([]);
  });

  test('verifies representative protected routes redirect to their login portals', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const routes = [
      { path: '/admin/dashboard', loginPath: '/login/admin' },
      { path: '/admin/students', loginPath: '/login/admin' },
      { path: '/admin/fees', loginPath: '/login/admin' },
      { path: '/admin/payments/manual', loginPath: '/login/admin' },
      { path: '/admin/transactions', loginPath: '/login/admin' },
      { path: '/admin/reports', loginPath: '/login/admin' },
      { path: '/parent/dashboard', loginPath: '/login/parent' },
      { path: '/parent/pay', loginPath: '/login/parent' },
      { path: '/student/dashboard', loginPath: '/login/student' },
    ];

    for (const { path, loginPath } of routes) {
      try {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
      } catch (error) {
        // Next.js can abort the original document navigation after a Server Component redirect.
        expect(String(error)).toContain('ERR_ABORTED');
      }

      await expect(page).toHaveURL(new RegExp(`${loginPath}$`), { timeout: 15_000 });
      await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
    }
  });

  test('verifies health API endpoint', async ({ request }) => {
    const healthResponse = await request.get('/api/health');
    expect(healthResponse.status()).toBe(200);

    const healthData = await healthResponse.json();
    expect(healthData).toEqual({
      status: 'ok',
      service: 'online-school-fees-system',
    });
  });

  test('verifies custom 404 not-found page', async ({ page }) => {
    await page.goto('/unknown-nonexistent-route');
    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
  });

  test('verifies password show/hide toggle on login page', async ({ page }) => {
    await page.goto('/login/admin');
    const passwordInput = page.getByPlaceholder('Enter password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = page.getByRole('button', { name: 'Show password' });
    await expect(toggleButton).toBeVisible();

    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide password' })).toBeVisible();

    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('verifies application security headers on response', async ({ request }) => {
    const response = await request.get('/login/admin');
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
  });
});
