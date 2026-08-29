import { chromium } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const baseUrl = (process.env.DEMO_BASE_URL ?? 'https://online-school-fees.vercel.app').replace(
  /\/$/,
  ''
);
const password = process.env.DEMO_PASSWORD ?? 'DemoPass123!';
const viewport = { width: 1440, height: 900 };
const outputDir = path.resolve('qa-artifacts/client-demo-desktop');
const screenshotDir = path.join(outputDir, 'screenshots');
const videoOutput = path.join(outputDir, 'client-demo-desktop.webm');
const indexOutput = path.join(outputDir, 'SCREENSHOT-INDEX.md');
const reportOutput = path.join(outputDir, 'CLIENT-QA-REPORT.md');
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
const reference = `DEMO-CLIENT-GCASH-${runStamp}`;

const captures = [];
const pageErrors = [];
const consoleErrors = [];
const responseErrors = [];
const expectedResponses = [];
const requestFailures = [];

function escapeMarkdown(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

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

async function getJson(context, pathname) {
  const response = await context.request.get(`${baseUrl}${pathname}`);
  if (!response.ok()) throw new Error(`${response.status()} ${pathname}`);
  return response.json();
}

async function waitForStablePage(page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);
}

async function waitForVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 45_000 }).catch((error) => {
    throw new Error(`${label} was not visible at ${locator.page().url()}: ${error.message}`);
  });
}

async function getScrollTarget(page) {
  return page.evaluate(() => {
    const candidates = [
      { selector: '#main-content', element: document.querySelector('#main-content') },
      { selector: 'main', element: document.querySelector('main') },
    ];
    const internalTarget = candidates.find(
      ({ element }) => element && element.scrollHeight > element.clientHeight + 16
    );
    return internalTarget
      ? { type: 'element', selector: internalTarget.selector }
      : { type: 'document' };
  });
}

async function getScrollMetrics(page, target) {
  return page.evaluate((nextTarget) => {
    const element =
      nextTarget.type === 'document'
        ? (document.scrollingElement ?? document.documentElement)
        : document.querySelector(nextTarget.selector);
    return {
      clientHeight: nextTarget.type === 'document' ? window.innerHeight : element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: nextTarget.type === 'document' ? window.scrollY : element.scrollTop,
    };
  }, target);
}

async function setScrollTop(page, target, scrollTop) {
  await page.evaluate(
    ({ nextTarget, nextScrollTop }) => {
      if (nextTarget.type === 'document') {
        window.scrollTo({ top: nextScrollTop, behavior: 'instant' });
        return;
      }
      const element = document.querySelector(nextTarget.selector);
      element.scrollTop = nextScrollTop;
    },
    { nextTarget: target, nextScrollTop: scrollTop }
  );
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

function screenshotName(id, position) {
  return `${id}-${position}.jpg`;
}

async function captureCurrent(page, details) {
  const { id, route, account, state, ready, label } = details;
  await waitForVisible(ready(), label);
  await waitForStablePage(page);
  await assertNoHorizontalOverflow(page, label);

  const scrollTarget = await getScrollTarget(page);
  const metrics = await getScrollMetrics(page, scrollTarget);
  const positions =
    metrics.scrollHeight > metrics.clientHeight + 16
      ? [
          ['top', 0],
          ['middle', Math.max(0, Math.floor((metrics.scrollHeight - metrics.clientHeight) / 2))],
          ['bottom', Math.max(0, metrics.scrollHeight - metrics.clientHeight)],
        ]
      : [['viewport', 0]];

  for (const [position, scrollTop] of positions) {
    await setScrollTop(page, scrollTarget, scrollTop);
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(screenshotDir, screenshotName(id, position)),
      type: 'jpeg',
      quality: 88,
      fullPage: false,
    });
    captures.push({
      id,
      route,
      account,
      state,
      position,
      file: `screenshots/${screenshotName(id, position)}`,
      url: page.url(),
    });
  }

  await setScrollTop(page, scrollTarget, 0);
  await page.waitForTimeout(1_200);
}

async function captureRoute(page, details) {
  await page.goto(`${baseUrl}${details.route}`, { waitUntil: 'domcontentloaded' });
  await captureCurrent(page, details);
}

async function captureLogin(page, id, route, account, label) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await captureCurrent(page, {
    id,
    route,
    account,
    state: 'empty password field',
    label,
    ready: () => page.getByRole('heading').first(),
  });
}

function addExpectedResponse(response, reason) {
  expectedResponses.push({ status: response.status(), url: response.url(), reason });
}

function isExpectedMockCheckoutResponse(response) {
  return new URL(response.url()).pathname === '/parent/pay/mock-checkout';
}

async function writeArtifacts(videoPath, runError) {
  const sortedCaptures = [...captures].sort((a, b) => a.file.localeCompare(b.file));
  const indexLines = [
    '# Client demo screenshot index',
    '',
    `Captured on ${new Date().toISOString()} against \`${baseUrl}\`.`,
    '',
    `Viewport: ${viewport.width} x ${viewport.height}. Browser: Chromium. Theme: light.`,
    '',
    `Run reference: \`${reference}\`.`,
    '',
    '| ID | Route | Account | State | Position | File |',
    '| --- | --- | --- | --- | --- | --- |',
    ...sortedCaptures.map(
      (capture) =>
        `| ${escapeMarkdown(capture.id)} | ${escapeMarkdown(capture.route)} | ${escapeMarkdown(capture.account)} | ${escapeMarkdown(capture.state)} | ${escapeMarkdown(capture.position)} | [${escapeMarkdown(capture.file)}](${escapeMarkdown(capture.file)}) |`
    ),
    '',
    `Total screenshot files: ${sortedCaptures.length}.`,
    '',
    'The mock checkout route is a test-only flow. In production it is intentionally disabled and was captured as the application Page Not Found screen.',
  ];

  const reportLines = [
    '# Client demo QA report',
    '',
    `Run date: ${new Date().toISOString()}`,
    `Base URL: ${baseUrl}`,
    `Viewport: ${viewport.width} x ${viewport.height}`,
    `Reference: ${reference}`,
    '',
    '## Result',
    '',
    runError ? `FAILED: ${runError.message}` : 'PASSED: all planned captures completed.',
    '',
    '## Browser checks',
    '',
    `- Screenshot files: ${sortedCaptures.length}`,
    `- Page errors: ${pageErrors.length}`,
    `- Console errors: ${consoleErrors.length}`,
    `- Unexpected HTTP responses: ${responseErrors.length}`,
    `- Request failures: ${requestFailures.length}`,
    `- Expected route responses: ${expectedResponses.length}`,
    `- Native Playwright video: ${videoPath ? 'client-demo-desktop.webm' : 'not created'}`,
    '',
    '## Expected route responses',
    '',
    ...(expectedResponses.length
      ? expectedResponses.map((item) => `- ${item.status} ${item.url} (${item.reason})`)
      : ['- None']),
    '',
    '## Errors',
    '',
    ...(pageErrors.length ? pageErrors.map((item) => `- Page: ${item}`) : ['- Page errors: none']),
    ...(consoleErrors.length
      ? consoleErrors.map((item) => `- Console: ${item}`)
      : ['- Console errors: none']),
    ...(responseErrors.length
      ? responseErrors.map((item) => `- HTTP: ${item}`)
      : ['- Unexpected HTTP errors: none']),
    ...(requestFailures.length
      ? requestFailures.map((item) => `- Request: ${item}`)
      : ['- Request failures: none']),
    '',
    '## Data checks',
    '',
    '- Only the four fictional demo accounts were used.',
    '- The payment proof was submitted through the visible Parent UI.',
    '- Finance approval was completed through the visible Finance UI and confirmation dialog.',
    '- Receipt and payment history were checked in Parent, Student, and Administrator views.',
    '- The test-only mock checkout route is intentionally disabled in production and was captured as the application Page Not Found screen.',
    '- Passwords, cookies, and tokens were not entered into the recording page.',
  ];

  await writeFile(indexOutput, `${indexLines.join('\n')}\n`, 'utf8');
  await writeFile(reportOutput, `${reportLines.join('\n')}\n`, 'utf8');
}

async function runCapture() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(screenshotDir, { recursive: true });
  const videoDir = await mkdir(path.join(os.tmpdir(), `osfs-client-video-${runStamp}`), {
    recursive: true,
  }).then(() => path.join(os.tmpdir(), `osfs-client-video-${runStamp}`));
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
  let runError;
  let videoPath;
  let studentId;
  let receiptId;
  let paymentId;

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error')
      consoleErrors.push(`${message.text()} @ ${message.location().url}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      if (isExpectedMockCheckoutResponse(response)) {
        addExpectedResponse(response, 'test-only production route is intentionally disabled');
      } else {
        responseErrors.push(`${response.status()} ${response.url()}`);
      }
    }
  });
  page.on('requestfailed', (request) => {
    const failureText = request.failure()?.errorText ?? '';
    if (['net::ERR_ABORTED', 'net::ERR_CANCELED', 'NS_BINDING_ABORTED'].includes(failureText)) {
      return;
    }
    requestFailures.push(`${request.method()} ${request.url()} ${failureText}`);
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await captureCurrent(page, {
      id: 'PUB-01',
      route: '/',
      account: 'anonymous',
      state: 'public portal selection',
      label: 'public portal selection',
      ready: () => page.getByRole('heading').first(),
    });
    await captureLogin(page, 'AUTH-01', '/login/admin', accounts.admin, 'administrator login');
    await captureLogin(page, 'AUTH-02', '/login/parent', accounts.parent, 'parent login');
    await captureLogin(page, 'AUTH-03', '/login/student', accounts.student, 'student login');
    await captureRoute(page, {
      id: 'SEC-01',
      route: '/unauthorized',
      account: 'anonymous',
      state: 'access denied screen',
      label: 'unauthorized screen',
      ready: () => page.getByRole('heading').first(),
    });

    await signIn(context, 'admin', accounts.admin);
    await captureRoute(page, {
      id: 'ADM-01',
      route: '/admin/dashboard',
      account: accounts.admin,
      state: 'initial seeded state',
      label: 'administrator dashboard',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'ADM-02',
      route: '/admin/students',
      account: accounts.admin,
      state: 'student directory',
      label: 'student directory',
      ready: () => page.getByRole('heading', { name: 'Student Directory', exact: true }),
    });

    await signIn(context, 'parent', accounts.parent);
    const children = await getJson(context, '/api/portal/parent/children');
    const child = children.find((item) => item.studentNumber === 'DEMO-0001');
    if (!child) throw new Error('DEMO-0001 was not returned by the parent children endpoint');
    studentId = child.studentId;

    await signIn(context, 'admin', accounts.admin);
    await captureRoute(page, {
      id: 'ADM-03',
      route: `/admin/students/${studentId}`,
      account: accounts.admin,
      state: 'Alex Santos DEMO-0001 profile',
      label: 'student profile',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'ADM-04',
      route: '/admin/guardians',
      account: accounts.admin,
      state: 'guardian directory',
      label: 'guardian directory',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'ADM-05',
      route: '/admin/fees',
      account: accounts.admin,
      state: 'fee categories and structures',
      label: 'fees management',
      ready: () => page.getByRole('heading', { name: 'Fees Management', exact: true }),
    });
    await captureRoute(page, {
      id: 'ADM-06',
      route: '/admin/payments/manual',
      account: accounts.admin,
      state: 'manual payment form without submission',
      label: 'manual payment form',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'ADM-08',
      route: '/admin/transactions',
      account: accounts.admin,
      state: 'initial seeded transactions',
      label: 'administrator transactions',
      ready: () => page.getByRole('heading', { name: 'Financial transactions log', exact: true }),
    });
    await captureRoute(page, {
      id: 'ADM-10',
      route: '/admin/reports',
      account: accounts.admin,
      state: 'initial seeded reports and reconciliation',
      label: 'administrator reports',
      ready: () =>
        page.getByRole('heading', { name: 'Financial reports and statements', exact: true }),
    });
    await captureRoute(page, {
      id: 'ADM-11',
      route: '/admin/notifications',
      account: accounts.admin,
      state: 'administrator notifications',
      label: 'administrator notifications',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'ADM-12',
      route: '/admin/announcements',
      account: accounts.admin,
      state: 'administrator announcements',
      label: 'administrator announcements',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'ADM-13',
      route: '/admin/users',
      account: accounts.admin,
      state: 'user access and roles',
      label: 'administrator users',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'ADM-14',
      route: '/admin/settings',
      account: accounts.admin,
      state: 'school configuration',
      label: 'administrator settings',
      ready: () => page.locator('main').getByRole('heading').first(),
    });

    await signIn(context, 'finance', accounts.finance);
    await captureRoute(page, {
      id: 'FIN-01',
      route: '/admin/dashboard',
      account: accounts.finance,
      state: 'Finance Staff dashboard and restricted navigation',
      label: 'Finance Staff dashboard',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'FIN-02',
      route: '/admin/payments/manual',
      account: accounts.finance,
      state: 'Finance Staff manual payment form',
      label: 'Finance Staff manual payment form',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'FIN-04',
      route: '/admin/transactions',
      account: accounts.finance,
      state: 'Finance Staff transaction log',
      label: 'Finance Staff transactions',
      ready: () => page.getByRole('heading', { name: 'Financial transactions log', exact: true }),
    });
    await captureRoute(page, {
      id: 'FIN-05',
      route: '/admin/reports',
      account: accounts.finance,
      state: 'Finance Staff reports and reconciliation',
      label: 'Finance Staff reports',
      ready: () =>
        page.getByRole('heading', { name: 'Financial reports and statements', exact: true }),
    });

    await signIn(context, 'parent', accounts.parent);
    await captureRoute(page, {
      id: 'PAR-01',
      route: '/parent/dashboard',
      account: accounts.parent,
      state: 'initial unpaid balance',
      label: 'parent dashboard',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'PAR-02',
      route: `/parent/children/${studentId}`,
      account: accounts.parent,
      state: 'Alex Santos DEMO-0001 account',
      label: 'parent child account',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'PAR-03',
      route: '/parent/history',
      account: accounts.parent,
      state: 'initial payment history',
      label: 'parent payment history',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'PAR-08',
      route: '/parent/notifications',
      account: accounts.parent,
      state: 'parent notifications',
      label: 'parent notifications',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'PAR-09',
      route: '/parent/announcements',
      account: accounts.parent,
      state: 'parent announcements',
      label: 'parent announcements',
      ready: () => page.locator('main').getByRole('heading').first(),
    });

    await page.goto(`${baseUrl}/parent/pay?studentId=${studentId}`, {
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
      name: 'fictional-client-proof.png',
      mimeType: 'image/png',
      buffer: proofBuffer,
    });
    await captureCurrent(page, {
      id: 'PAR-04',
      route: `/parent/pay?studentId=${studentId}`,
      account: accounts.parent,
      state: 'GCash selected and proof form completed before submission',
      label: 'completed parent payment form',
      ready: () => page.getByRole('button', { name: 'Submit payment proof', exact: true }),
    });
    await page.getByRole('button', { name: 'Submit payment proof', exact: true }).click();
    await waitForVisible(
      page.getByText('PENDING VERIFICATION', { exact: true }),
      'pending payment proof'
    );
    await captureCurrent(page, {
      id: 'PAR-05',
      route: '/parent/payment-submissions',
      account: accounts.parent,
      state: 'pending verification with unchanged balance',
      label: 'parent pending payment proof',
      ready: () => page.getByText('PENDING VERIFICATION', { exact: true }),
    });

    await signIn(context, 'finance', accounts.finance);
    await page.goto(`${baseUrl}/admin/payment-submissions`, { waitUntil: 'domcontentloaded' });
    await waitForVisible(
      page.getByRole('heading', { name: 'GCash and Maya payment proofs', exact: true }),
      'Finance Staff payment proofs'
    );
    await page.getByLabel('Search student or reference').fill(reference);
    const pendingRow = page.getByRole('row').filter({ hasText: reference });
    await waitForVisible(pendingRow, 'Finance Staff pending proof row');
    await pendingRow.click();
    await waitForVisible(
      page.getByText(`Reference: ${reference}`, { exact: true }),
      'proof review details'
    );
    await captureCurrent(page, {
      id: 'FIN-03',
      route: '/admin/payment-submissions',
      account: accounts.finance,
      state: 'pending proof selected for review',
      label: 'Finance Staff proof review',
      ready: () => page.getByRole('button', { name: 'Approve and post payment', exact: true }),
    });
    await page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Approve and post payment', exact: true }).click();
    await waitForVisible(
      page.getByRole('status').filter({ hasText: 'Payment proof approved and posted.' }),
      'approved payment proof'
    );
    await captureCurrent(page, {
      id: 'FIN-03-APPROVED',
      route: '/admin/payment-submissions',
      account: accounts.finance,
      state: 'approval completed and payment posted',
      label: 'Finance Staff approved proof',
      ready: () =>
        page.getByRole('status').filter({ hasText: 'Payment proof approved and posted.' }),
    });

    await signIn(context, 'parent', accounts.parent);
    const submissions = await getJson(
      context,
      '/api/portal/parent/payment-submissions?page=1&pageSize=20'
    );
    const approvedSubmission = submissions.items.find((item) => item.referenceNumber === reference);
    if (!approvedSubmission?.receiptId || !approvedSubmission.approvedPaymentId) {
      throw new Error('Approved submission did not include a receipt and payment ID');
    }
    receiptId = approvedSubmission.receiptId;
    paymentId = approvedSubmission.approvedPaymentId;

    await captureRoute(page, {
      id: 'PAR-01-AFTER',
      route: '/parent/dashboard',
      account: accounts.parent,
      state: 'post-approval balance and payment state',
      label: 'parent dashboard after payment',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'PAR-06',
      route: '/parent/payment-submissions',
      account: accounts.parent,
      state: 'approved proof with system-generated receipt link',
      label: 'parent approved payment proof',
      ready: () => page.getByRole('row').filter({ hasText: reference }),
    });
    const approvedRow = page.getByRole('row').filter({ hasText: reference });
    await approvedRow.getByRole('link', { name: /View system-generated receipt/ }).click();
    await captureCurrent(page, {
      id: 'PAR-07',
      route: `/parent/receipts/${receiptId}`,
      account: accounts.parent,
      state: 'system-generated receipt after approval',
      label: 'parent receipt',
      ready: () => page.getByRole('heading', { name: /System-generated payment receipt/i }),
    });
    await captureRoute(page, {
      id: 'PAR-03-AFTER',
      route: '/parent/history',
      account: accounts.parent,
      state: 'payment history after approval',
      label: 'parent payment history after approval',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await page.goto(`${baseUrl}/parent/pay/mock-checkout`, { waitUntil: 'domcontentloaded' });
    await waitForVisible(page.getByRole('heading').first(), 'test-only mock checkout response');
    await captureCurrent(page, {
      id: 'PAR-10',
      route: '/parent/pay/mock-checkout',
      account: accounts.parent,
      state: 'test-only route disabled in production',
      label: 'test-only mock checkout response',
      ready: () => page.getByRole('heading').first(),
    });

    await signIn(context, 'student', accounts.student);
    await captureRoute(page, {
      id: 'STU-01',
      route: '/student/dashboard',
      account: accounts.student,
      state: 'student dashboard after posted payment',
      label: 'student dashboard',
      ready: () => page.getByText(/Welcome, Alex!/),
    });
    await captureRoute(page, {
      id: 'STU-02',
      route: '/student/account',
      account: accounts.student,
      state: 'student account and assessment',
      label: 'student account',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'STU-03',
      route: '/student/history',
      account: accounts.student,
      state: 'student payment history after posted payment',
      label: 'student payment history',
      ready: () =>
        page.locator('main').getByRole('heading', { name: 'Payment history', exact: true }),
    });
    await captureRoute(page, {
      id: 'STU-04',
      route: `/student/receipts/${receiptId}`,
      account: accounts.student,
      state: 'same system-generated receipt',
      label: 'student receipt',
      ready: () => page.getByRole('heading', { name: /System-generated payment receipt/i }),
    });
    await captureRoute(page, {
      id: 'STU-05',
      route: '/student/notifications',
      account: accounts.student,
      state: 'student notifications',
      label: 'student notifications',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'STU-06',
      route: '/student/announcements',
      account: accounts.student,
      state: 'student announcements',
      label: 'student announcements',
      ready: () => page.locator('main').getByRole('heading').first(),
    });

    await signIn(context, 'admin', accounts.admin);
    await captureRoute(page, {
      id: 'ADM-01-AFTER',
      route: '/admin/dashboard',
      account: accounts.admin,
      state: 'post-approval dashboard',
      label: 'administrator dashboard after payment',
      ready: () => page.locator('main').getByRole('heading').first(),
    });
    await captureRoute(page, {
      id: 'ADM-07',
      route: '/admin/payment-submissions',
      account: accounts.admin,
      state: 'payment proof queue after approval',
      label: 'administrator payment proofs',
      ready: () =>
        page.getByRole('heading', { name: 'GCash and Maya payment proofs', exact: true }),
    });
    await captureRoute(page, {
      id: 'ADM-08-AFTER',
      route: '/admin/transactions',
      account: accounts.admin,
      state: 'new posted transaction visible',
      label: 'administrator transactions after payment',
      ready: () => page.getByRole('heading', { name: 'Financial transactions log', exact: true }),
    });
    await captureRoute(page, {
      id: 'ADM-09',
      route: `/admin/transactions/${paymentId}`,
      account: accounts.admin,
      state: 'new posted transaction detail',
      label: 'administrator transaction detail',
      ready: () => page.getByRole('heading', { name: /Transaction details/i }),
    });
    await captureRoute(page, {
      id: 'ADM-10-AFTER',
      route: '/admin/reports',
      account: accounts.admin,
      state: 'post-approval reconciliation and reports',
      label: 'administrator reports after payment',
      ready: () =>
        page.getByRole('heading', { name: 'Financial reports and statements', exact: true }),
    });
  } catch (error) {
    runError = error;
  } finally {
    await context.close();
    if (video) videoPath = await video.path();
    await browser.close();
    if (videoPath) {
      const { copyFile } = await import('node:fs/promises');
      await copyFile(videoPath, videoOutput);
    }
    await rm(videoDir, { recursive: true, force: true });
    await writeArtifacts(videoPath, runError);
  }

  if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
  if (responseErrors.length)
    throw new Error(`Browser response errors: ${responseErrors.join(' | ')}`);
  if (requestFailures.length)
    throw new Error(`Browser request failures: ${requestFailures.join(' | ')}`);
  if (runError) throw runError;

  console.log(`Reference: ${reference}`);
  console.log(`Receipt ID: ${receiptId}`);
  console.log(`Payment ID: ${paymentId}`);
  console.log(`Screenshots: ${captures.length}`);
  console.log(`Video: ${videoOutput}`);
  console.log(`Index: ${indexOutput}`);
  console.log(`Report: ${reportOutput}`);
}

await runCapture();
