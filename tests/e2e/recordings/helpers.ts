import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { formatCentavos } from '@/lib/utils/currency';

export const DEMO_PASSWORD = 'DemoPass123!';
export const recordingOutputDirectory = path.resolve('artifacts/core-workflow-videos');

export async function login(page: Page, portal: 'admin' | 'parent', email: string) {
  await page.goto(`/login/${portal}`);
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(
    new RegExp(`/${portal === 'admin' ? 'admin' : 'parent'}/dashboard$`)
  );
}

export async function logout(page: Page, portal: 'admin' | 'parent') {
  const logoutButton = page.locator('header').getByRole('button', { name: 'Logout', exact: true });
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();
  await expect(page).toHaveURL(new RegExp(`/login/${portal}$`));
}

export async function presentationPause(page: Page, milliseconds = 900) {
  await page.waitForTimeout(milliseconds);
}

export async function openParentChild(page: Page, studentNumber: string) {
  await page.goto('/parent/dashboard');
  await expect(page.getByRole('heading', { name: 'Your children', exact: true })).toBeVisible();

  const childCard = page.locator('div.divide-y > div').filter({ hasText: studentNumber });
  await expect(childCard).toHaveCount(1);
  await childCard.getByRole('link', { name: 'View details', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/children\/[^/]+$/);
  await expect(page.getByText(studentNumber, { exact: false }).first()).toBeVisible();

  const studentId = new URL(page.url()).pathname.split('/').at(-1);
  expect(studentId, `Student id for ${studentNumber}`).toBeTruthy();
  return studentId as string;
}

export async function readChildBalance(page: Page) {
  const balanceLabel = page.getByText('Outstanding balance', { exact: true });
  await expect(balanceLabel).toBeVisible();
  return (await balanceLabel.locator('..').locator('p').first().innerText()).trim();
}

export async function assertChildBalance(page: Page, expectedCentavos: number) {
  await expect(page.getByText('Outstanding balance', { exact: true }).locator('..')).toContainText(
    formatCentavos(expectedCentavos)
  );
}

export async function readPaymentFormBalance(page: Page) {
  const balanceLabel = page.getByText('Authoritative current balance', { exact: true });
  await expect(balanceLabel).toBeVisible();
  return (await balanceLabel.locator('..').locator('p').nth(1).innerText()).trim();
}

export async function saveRecording(
  page: Page,
  testInfo: TestInfo,
  filename: string,
  startedAt: number
) {
  const video = page.video();
  if (!video) throw new Error('The recording page was not configured with Playwright video.');

  await page.context().close();
  const sourcePath = await video.path();
  const destinationPath = path.join(recordingOutputDirectory, filename);
  await mkdir(recordingOutputDirectory, { recursive: true });
  await copyFile(sourcePath, destinationPath);

  const file = await stat(destinationPath);
  expect(file.size, `${filename} should be non-empty`).toBeGreaterThan(0);
  const elapsedMs = Date.now() - startedAt;
  console.log(
    `[recording] ${filename} · ${file.size} bytes · approximately ${Math.ceil(elapsedMs / 1000)}s test duration`
  );
  return { path: destinationPath, size: file.size, durationMs: elapsedMs };
}
