import { test, expect } from '@playwright/test';

test.describe('Foundation Application & Scaffold Navigation Smoke Tests', () => {
  test('opens homepage hub and verifies 20-screen reference directory', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        name: 'Online School Fees Monitoring & Payment System',
      })
    ).toBeVisible();

    await expect(page.getByText(/20 \/ 20 Reference Screens Scaffolded/i)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('verifies representative portal routes render cleanly', async ({ page }) => {
    const routes = [
      '/login/admin',
      '/admin/dashboard',
      '/admin/students',
      '/admin/fees',
      '/admin/payments/manual',
      '/admin/transactions',
      '/admin/reports',
      '/login/parent',
      '/parent/dashboard',
      '/parent/pay',
      '/login/student',
      '/student/dashboard',
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
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
});
