import { chromium } from '@playwright/test';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const baseUrl = (process.env.DEMO_BASE_URL ?? 'https://online-school-fees.vercel.app').replace(
  /\/$/,
  ''
);
const password = process.env.DEMO_PASSWORD ?? 'DemoPass123!';
const viewport = { width: 1440, height: 900 };
const outputDir = path.resolve('qa-artifacts/demo-desktop');
const videoOutput = path.join(outputDir, 'core-workflow-playwright.webm');
const proofBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const accounts = {
  admin: 'admin@demo.school',
  finance: 'finance@demo.school',
  parent: 'parent@demo.school',
  student: 'student@demo.school',
};

const runStamp = new Date()
  .toISOString()
  .replace(/[-:TZ.]/g, '')
  .slice(0, 14);
const reference = `DEMO-RECORDING-GCASH-${runStamp}`;

async function signIn(context, portal, email) {
  await context.clearCookies();
  const response = await context.request.post(`${baseUrl}/api/auth/sign-in/email`, {
    headers: {
      origin: baseUrl,
      referer: `${baseUrl}/login/${portal}`,
      'content-type': 'application/json',
    },
    data: { email, password, rememberMe: false },
  });

  if (!response.ok()) {
    const responseText = await response.text();
    throw new Error(
      `Could not sign in ${portal}: ${response.status()} ${responseText.slice(0, 300)}`
    );
  }
}

async function waitForPage(page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);
}

async function waitForVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 45_000 }).catch((error) => {
    throw new Error(`${label} was not visible at ${locator.page().url()}: ${error.message}`);
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  if (dimensions.scrollWidth > dimensions.clientWidth + 2) {
    throw new Error(
      `${label} has horizontal overflow: ${dimensions.scrollWidth}px content in ${dimensions.clientWidth}px viewport`
    );
  }
}

async function capture(page, filename, readyLocator, label) {
  await waitForVisible(readyLocator, label);
  await waitForPage(page);
  await assertNoHorizontalOverflow(page, label);
  await page.screenshot({
    path: path.join(outputDir, filename),
    type: 'jpeg',
    quality: 88,
    fullPage: false,
  });
  await page.waitForTimeout(1_800);
}

async function getDemoStudent(context) {
  const response = await context.request.get(`${baseUrl}/api/portal/parent/children`);
  if (!response.ok()) {
    throw new Error(`Could not load parent children: ${response.status()}`);
  }

  const children = await response.json();
  const child = children.find((item) => item.studentNumber === 'DEMO-0001');
  if (!child) {
    throw new Error('DEMO-0001 was not returned by the parent children endpoint');
  }

  return child;
}

async function runRecording() {
  await mkdir(outputDir, { recursive: true });
  const videoDir = await mkdtemp(path.join(os.tmpdir(), 'osfs-playwright-video-'));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    screen: viewport,
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'Asia/Manila',
    colorScheme: 'light',
    recordVideo: { dir: videoDir, size: viewport },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(45_000);
  const video = page.video();
  const pageErrors = [];
  const consoleErrors = [];
  const responseErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) responseErrors.push(`${response.status()} ${response.url()}`);
  });

  let runError;
  let capturedVideoPath;

  try {
    await signIn(context, 'admin', accounts.admin);
    await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await capture(
      page,
      '01-admin-dashboard-clean.jpg',
      page.locator('main').getByRole('heading').first(),
      'admin dashboard'
    );

    await page.goto(`${baseUrl}/admin/students`, { waitUntil: 'domcontentloaded' });
    await capture(
      page,
      '02-admin-students-directory.jpg',
      page.getByRole('heading', { name: 'Student Directory', exact: true }),
      'student directory'
    );

    await page.goto(`${baseUrl}/admin/fees`, { waitUntil: 'domcontentloaded' });
    await capture(
      page,
      '03-admin-fees-management.jpg',
      page.getByRole('heading', { name: 'Fees Management', exact: true }),
      'fees management'
    );

    await signIn(context, 'parent', accounts.parent);
    const child = await getDemoStudent(context);
    await page.goto(`${baseUrl}/parent/pay?studentId=${child.studentId}`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForVisible(
      page.getByRole('heading', { name: 'Submit GCash or Maya payment proof', exact: true }),
      'parent payment form'
    );
    await page.getByRole('button', { name: /^GCASH/ }).click();
    await waitForVisible(page.getByText(/OSFS Demo GCash Account/), 'GCash destination');
    await page.getByLabel('Amount transferred (PHP)').fill('100.00');
    await page.getByLabel('Transaction/reference number').fill(reference);
    await page
      .getByLabel('Transaction date and time')
      .fill(new Date(Date.now() - 60_000).toISOString().slice(0, 16));
    await page.getByLabel('Payment screenshot').setInputFiles({
      name: 'fictional-payment-proof.png',
      mimeType: 'image/png',
      buffer: proofBuffer,
    });
    await capture(
      page,
      '04-parent-payment-form.jpg',
      page.getByRole('button', { name: 'Submit payment proof', exact: true }),
      'completed parent payment form'
    );

    await page.getByRole('button', { name: 'Submit payment proof', exact: true }).click();
    await waitForVisible(
      page.getByText('PENDING VERIFICATION', { exact: true }),
      'pending payment proof'
    );
    await capture(
      page,
      '05-parent-payment-proofs-pending.jpg',
      page.getByText('PENDING VERIFICATION', { exact: true }),
      'parent pending proof'
    );

    await signIn(context, 'finance', accounts.finance);
    await page.goto(`${baseUrl}/admin/payment-submissions`, { waitUntil: 'domcontentloaded' });
    await waitForVisible(
      page.getByRole('heading', { name: 'GCash and Maya payment proofs', exact: true }),
      'finance payment proofs'
    );
    const search = page.getByLabel('Search student or reference');
    await search.fill(reference);
    const pendingRow = page.getByRole('row').filter({ hasText: reference });
    await waitForVisible(pendingRow, 'finance pending proof row');
    await pendingRow.click();
    await waitForVisible(
      page.getByText(`Reference: ${reference}`, { exact: true }),
      'finance proof details'
    );
    await capture(
      page,
      '06-finance-payment-proofs-pending.jpg',
      page.getByRole('button', { name: 'Approve and post payment', exact: true }),
      'finance pending proof review'
    );

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Approve and post payment', exact: true }).click();
    await waitForVisible(
      page.getByRole('status').filter({ hasText: 'Payment proof approved and posted.' }),
      'approved payment proof'
    );

    await signIn(context, 'parent', accounts.parent);
    await page.goto(`${baseUrl}/parent/payment-submissions`, { waitUntil: 'domcontentloaded' });
    const approvedRow = page.getByRole('row').filter({ hasText: reference });
    await waitForVisible(approvedRow, 'parent approved proof row');
    await approvedRow.getByRole('link', { name: /View system-generated receipt/ }).click();
    await waitForVisible(
      page.getByRole('heading', { name: /System-generated payment receipt/i }),
      'parent receipt'
    );
    const receiptUrl = page.url();
    await capture(
      page,
      '07-parent-receipt.jpg',
      page.getByRole('heading', { name: /System-generated payment receipt/i }),
      'parent receipt'
    );

    await page.goto(`${baseUrl}/parent/dashboard`, { waitUntil: 'domcontentloaded' });
    await capture(
      page,
      '08-parent-dashboard-after-payment.jpg',
      page.getByText('WITH REMAINING BALANCE', { exact: true }).first(),
      'parent dashboard after payment'
    );

    await signIn(context, 'student', accounts.student);
    await page.goto(`${baseUrl}/student/dashboard`, { waitUntil: 'domcontentloaded' });
    await capture(
      page,
      '09-student-dashboard.jpg',
      page.getByText(/Welcome, Alex!/),
      'student dashboard'
    );

    await page.goto(`${baseUrl}/student/history`, { waitUntil: 'domcontentloaded' });
    await capture(
      page,
      '10-student-payment-history.jpg',
      page.locator('main').getByRole('heading', { name: 'Payment history', exact: true }),
      'student payment history'
    );

    await signIn(context, 'admin', accounts.admin);
    await page.goto(`${baseUrl}/admin/transactions`, { waitUntil: 'domcontentloaded' });
    await capture(
      page,
      '11-admin-transactions-posted.jpg',
      page.getByRole('heading', { name: 'Financial transactions log', exact: true }),
      'admin transactions'
    );

    await page.goto(`${baseUrl}/admin/reports`, { waitUntil: 'domcontentloaded' });
    await capture(
      page,
      '12-admin-reports-reconciliation.jpg',
      page.getByRole('heading', { name: 'Financial reports and statements', exact: true }),
      'admin reports'
    );

    console.log(`Recorded workflow reference: ${reference}`);
    console.log(`Receipt page: ${receiptUrl}`);
  } catch (error) {
    runError = error;
  } finally {
    await context.close();
    if (video) {
      capturedVideoPath = await video.path();
      await copyFile(capturedVideoPath, videoOutput);
    }
    await browser.close();
    await rm(videoDir, { recursive: true, force: true });
  }

  if (pageErrors.length > 0) {
    throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
  }
  if (responseErrors.length > 0) {
    throw new Error(`Browser response errors: ${responseErrors.join(' | ')}`);
  }
  if (consoleErrors.length > 0) {
    throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  }
  if (runError) throw runError;

  console.log(`Playwright video: ${videoOutput}`);
  console.log(`Source video: ${capturedVideoPath}`);
}

await runRecording();
