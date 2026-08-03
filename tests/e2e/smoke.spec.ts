import { test, expect } from '@playwright/test';

test.describe('Foundation Application Smoke Test', () => {
  test('opens homepage, verifies status, checks health endpoint and console errors', async ({
    page,
    request,
  }) => {
    const consoleErrors: string[] = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Visit homepage
    await page.goto('/');

    // 2. Confirm project name is visible
    await expect(
      page.getByRole('heading', {
        name: 'Online School Fees Monitoring & Payment System',
      })
    ).toBeVisible();

    // 3. Confirm foundation status is visible
    await expect(page.getByText(/20 \/ 20 Reference Screens Scaffolded/i)).toBeVisible();
    // 4. Confirm no major browser console errors occurred
    expect(consoleErrors).toEqual([]);

    // 5. Check health endpoint directly via HTTP request
    const healthResponse = await request.get('/api/health');
    expect(healthResponse.status()).toBe(200);

    const healthData = await healthResponse.json();
    expect(healthData).toEqual({
      status: 'ok',
      service: 'online-school-fees-system',
    });
  });
});
