import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.QA_BASE_URL ?? 'https://online-school-fees.vercel.app';
const outDir =
  process.env.QA_OUT_DIR ??
  'C:/Users/Ron/Documents/projects/clients/Online-School-Fees/artifacts/qa/core-2026-08-17T02-52-26-120Z/deployed';
const password = process.env.QA_DEMO_PASSWORD ?? 'DemoPass123!';
const suffix = `desktop-${Date.now()}`;
const proofBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

await mkdir(outDir, { recursive: true });

const results = {
  baseURL,
  viewport: { width: 1440, height: 900 },
  startedAt: new Date().toISOString(),
  screenshots: [],
  assertions: [],
  failures: [],
};

function record(name, details = {}) {
  results.assertions.push({ name, passed: true, ...details });
}

async function screenshot(page, name) {
  const path = `${outDir}/${name}.png`;
  try {
    await page.evaluate(() => {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) activeElement.blur();
      document.querySelectorAll('.skip-link').forEach((element) => {
        if (element instanceof HTMLElement) element.style.visibility = 'hidden';
      });
    });
    await page.screenshot({ path, fullPage: true });
    results.screenshots.push(path);
  } catch (error) {
    results.failures.push({ name: `screenshot:${name}`, error: String(error) });
  }
}

async function visible(locator, name) {
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  record(name);
}

async function hidden(locator, name) {
  await locator.waitFor({ state: 'hidden', timeout: 30_000 });
  record(name);
}

async function pageReady(page, locator, name) {
  await visible(locator, name);
  await page.waitForFunction(
    () =>
      !document.body.innerText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .some((line) => /^Loading(?:\s|…|\.)/i.test(line)),
    undefined,
    { timeout: 30_000 }
  );
  record(`${name}:no-loading-state`);
}

async function jsonRequest(request, method, path, data) {
  const response = await request[method.toLowerCase()](
    path,
    data === undefined ? undefined : { data }
  );
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  assert.equal(response.ok(), true, `${method} ${path} returned ${response.status()}: ${text}`);
  return body;
}

async function login(page, portal, email, screenshotName) {
  await page.goto(`/login/${portal}`);
  if (screenshotName) await screenshot(page, screenshotName);
  const emailLabel =
    portal === 'admin'
      ? 'Email / Admin ID'
      : portal === 'parent'
        ? 'Parent Email / Account ID'
        : 'Student Email / Account ID';
  await page.getByLabel(emailLabel).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(new RegExp(`/${portal === 'admin' ? 'admin' : portal}/dashboard$`), {
    timeout: 30_000,
  });
  record(`login:${portal}`, { email });
}

function firstItem(payload) {
  if (Array.isArray(payload)) return payload[0];
  if (Array.isArray(payload?.items)) return payload.items[0];
  if (Array.isArray(payload?.data)) return payload.data[0];
  return undefined;
}

const browser = await chromium.launch({ headless: true });
const contexts = [];

try {
  const context = async () => {
    const value = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
    });
    contexts.push(value);
    return value;
  };

  const adminContext = await context();
  const admin = await adminContext.newPage();
  await login(admin, 'admin', 'admin@demo.school', '01-admin-login');
  await pageReady(
    admin,
    admin.getByRole('heading', { name: 'School collections overview', exact: true }),
    'admin:dashboard-ready'
  );
  await screenshot(admin, '02-admin-dashboard');

  for (const [route, name] of [
    ['/admin/students', '03-admin-students'],
    ['/admin/fees', '04-admin-fees'],
    ['/admin/settings', '05-admin-settings'],
    ['/admin/announcements', '06-admin-announcements'],
    ['/admin/reports', '07-admin-reports'],
  ]) {
    await admin.goto(route);
    const headings = {
      '/admin/students': 'Student Directory',
      '/admin/fees': 'Fees Management',
      '/admin/settings': 'Settings',
      '/admin/announcements': 'Announcements',
      '/admin/reports': 'Financial reports and statements',
    };
    await pageReady(
      admin,
      admin.getByRole('heading', {
        name: headings[route],
        exact: true,
        level: route === '/admin/announcements' ? 2 : undefined,
      }),
      `admin:${name}:ready`
    );
    await screenshot(admin, name);
  }
  record('admin-core-routes');

  const announcementTitle = `QA desktop payment notice ${suffix}`;
  const announcement = await jsonRequest(admin.request, 'POST', '/api/admin/announcements', {
    title: announcementTitle,
    body: 'Fictional desktop QA payment verification notice.',
    audience: 'PARENT_AND_STUDENT',
    status: 'PUBLISHED',
    publishAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
  assert.ok(announcement.id, 'announcement was not created');
  record('announcement:create', { id: announcement.id });

  const parentContext = await context();
  const parent = await parentContext.newPage();
  await login(parent, 'parent', 'parent@demo.school', '08-parent-login');
  await pageReady(
    parent,
    parent.getByRole('heading', { name: 'Your children', level: 2 }),
    'parent:dashboard-loaded'
  );
  await screenshot(parent, '09-parent-dashboard');
  await parent.goto('/parent/announcements');
  await pageReady(
    parent,
    parent.getByRole('heading', { name: 'Announcements', level: 2 }),
    'parent:announcements-page'
  );
  await visible(
    parent.getByText(announcementTitle, { exact: true }),
    'parent:announcement-visible'
  );
  await screenshot(parent, '09-parent-announcements');

  let children = await jsonRequest(parent.request, 'GET', '/api/portal/parent/children');
  let child = children.find((item) => item.outstandingBalanceCentavos > 0);
  assert.ok(child, 'parent has no child with an outstanding balance');
  record('parent:owned-child-balance', { studentNumber: child.studentNumber });

  await parent.goto(`/parent/children/${child.studentId}`);
  await pageReady(
    parent,
    parent.getByText(`${child.firstName} ${child.lastName}`, { exact: true }),
    'parent:child-balance-ready'
  );
  await screenshot(parent, '10-parent-child-balance');
  await parent.goto(`/parent/pay?studentId=${child.studentId}`);
  await pageReady(
    parent,
    parent.getByRole('heading', { name: 'Submit GCash or Maya payment proof', exact: true }),
    'parent:manual-proof-form'
  );
  await visible(parent.getByRole('button', { name: /^GCASH/ }), 'parent:payment-channels-ready');
  await screenshot(parent, '11-parent-payment-channel-picker');

  const financeContext = await context();
  const finance = await financeContext.newPage();
  await login(finance, 'admin', 'finance@demo.school', '12-finance-login');
  await pageReady(
    finance,
    finance.getByRole('heading', { name: 'School collections overview', exact: true }),
    'finance:dashboard-ready'
  );
  await screenshot(finance, '13-finance-dashboard');
  await finance.goto('/admin/payments/manual');
  await pageReady(
    finance,
    finance.getByRole('heading', { name: 'Over-the-counter payment processing', exact: true }),
    'finance:manual-payment-ready'
  );
  await visible(finance.getByLabel('Search students'), 'finance:student-search-ready');
  await screenshot(finance, '14-finance-manual-payment-empty');

  const studentNumber = child.studentNumber;
  await finance.getByLabel('Search students').fill(studentNumber);
  const studentOption = finance.getByRole('option', { name: new RegExp(studentNumber) }).first();
  await visible(studentOption, 'finance:student-search-result');
  await studentOption.click();
  await visible(
    finance.getByText('Authoritative current balance'),
    'finance:authoritative-balance'
  );
  await pageReady(
    finance,
    finance.getByText(/^₱[\d,]+\.\d{2}$/).first(),
    'finance:authoritative-balance-loaded'
  );
  await screenshot(finance, '15-finance-manual-payment-selected');
  await finance.getByLabel('Payment method').selectOption('CASH');
  await finance.getByLabel('Amount received (PHP)').fill('10.00');
  const staffReference = `QA-DESKTOP-CASH-${suffix}`;
  await finance.getByLabel('Deposit/reference no. (optional)').fill(staffReference);
  await finance
    .getByRole('button', { name: 'Post payment and issue receipt', exact: true })
    .click();
  await visible(finance.getByText('Payment posted', { exact: true }), 'finance:payment-posted');
  await screenshot(finance, '16-finance-payment-posted');
  await finance.getByRole('link', { name: 'View transaction', exact: true }).click();
  await finance.waitForURL(/\/admin\/transactions\//, { timeout: 30_000 });
  const staffPaymentId = finance.url().split('/').pop();
  const receiptLink = finance.getByRole('link', { name: 'Receipt PDF', exact: true });
  await visible(receiptLink, 'finance:receipt-link');
  await pageReady(finance, receiptLink, 'finance:transaction-receipt-ready');
  await screenshot(finance, '17-finance-transaction-receipt');
  const receiptHref = await receiptLink.getAttribute('href');
  const receiptResponse = await finance.request.get(receiptHref);
  assert.equal(receiptResponse.status(), 200);
  assert.match(receiptResponse.headers()['content-type'] ?? '', /application\/pdf/);
  record('finance:receipt-pdf');

  await parent.goto('/parent/history');
  await pageReady(
    parent,
    parent.getByRole('heading', { name: 'Payment history', level: 2 }),
    'parent:payment-history'
  );
  const parentPayments = await jsonRequest(parent.request, 'GET', '/api/portal/parent/payments');
  const parentStaffPayment = parentPayments.find(
    (payment) => payment.referenceNumber === staffReference
  );
  assert.ok(parentStaffPayment, 'parent payment history API did not return the posted payment');
  assert.ok(parentStaffPayment.receiptId, 'parent payment history payment has no receipt');
  await visible(
    parent.getByRole('row').filter({ hasText: parentStaffPayment.receiptNumber }),
    'parent:staff-payment-visible'
  );
  await screenshot(parent, '18-parent-payment-history');

  const studentContext = await context();
  const student = await studentContext.newPage();
  await login(student, 'student', 'student@demo.school', '19-student-login');
  await pageReady(
    student,
    student.getByRole('heading', { name: /Welcome,|Student portal/ }),
    'student:dashboard-ready'
  );
  await screenshot(student, '20-student-dashboard');
  await student.goto('/student/account');
  await pageReady(student, student.getByText('Finance-posted fee assessments'), 'student:account');
  await screenshot(student, '21-student-account');
  await student.goto('/student/history');
  await visible(
    student.getByRole('heading', { name: 'Payment history', level: 2 }),
    'student:payment-history'
  );
  const studentPayments = await jsonRequest(student.request, 'GET', '/api/portal/student/payments');
  assert.ok(Array.isArray(studentPayments), 'student payment history API did not return a list');
  if (studentPayments.length > 0) {
    const firstStudentPayment = studentPayments[0];
    assert.ok(firstStudentPayment.receiptId, 'student payment history payment has no receipt');
    await visible(
      student.getByRole('row').filter({ hasText: firstStudentPayment.receiptNumber }),
      'student:payment-visible'
    );
  } else {
    await visible(
      student.getByText('No posted payments yet.', { exact: true }),
      'student:payment-history-empty-state'
    );
  }
  await screenshot(student, '22-student-payment-history');

  await jsonRequest(admin.request, 'POST', `/api/admin/payments/${staffPaymentId}/reverse`, {
    reason: 'Desktop QA cleanup reversal',
  });
  record('finance:staff-payment-reversed', { paymentId: staffPaymentId });

  children = await jsonRequest(parent.request, 'GET', '/api/portal/parent/children');
  child = children.find((item) => item.studentId === child.studentId);
  assert.ok(child && child.outstandingBalanceCentavos > 0, 'reversal did not restore a balance');

  const gcashAmount = child.outstandingBalanceCentavos;
  const gcashReference = `QA-DESKTOP-GCASH-${suffix}`;
  await parent.goto(`/parent/pay?studentId=${child.studentId}`);
  await parent.getByRole('button', { name: /^GCASH/ }).click();
  await pageReady(parent, parent.getByText(/OSFS Demo GCash Account/), 'parent:gcash-destination');
  await screenshot(parent, '23-parent-gcash-form');
  await parent.getByLabel('Amount transferred (PHP)').fill((gcashAmount / 100).toFixed(2));
  await parent.getByLabel('Transaction/reference number').fill(gcashReference);
  await parent
    .getByLabel('Transaction date and time')
    .fill(new Date(Date.now() - 60_000).toISOString().slice(0, 16));
  await parent.getByLabel('Screenshot/proof').setInputFiles({
    name: 'fictional-gcash-proof.png',
    mimeType: 'image/png',
    buffer: proofBuffer,
  });
  await parent.getByRole('button', { name: 'Submit payment proof', exact: true }).click();
  await visible(parent.getByText('PENDING VERIFICATION', { exact: true }), 'parent:gcash-pending');
  await screenshot(parent, '24-parent-gcash-pending');

  await finance.goto('/admin/payment-submissions');
  await finance.getByLabel('Search student or reference').fill(gcashReference);
  const gcashRow = finance.getByRole('row').filter({ hasText: gcashReference });
  await visible(gcashRow, 'finance:gcash-pending-row');
  await gcashRow.click();
  await pageReady(
    finance,
    finance.getByText(`Reference: ${gcashReference}`, { exact: true }),
    'finance:gcash-review'
  );
  await screenshot(finance, '25-finance-gcash-review');
  finance.once('dialog', (dialog) => dialog.accept());
  await finance.getByRole('button', { name: 'Approve and post payment', exact: true }).click();
  await visible(
    finance.getByRole('status').filter({ hasText: 'Payment proof approved and posted.' }),
    'finance:gcash-approved'
  );
  await visible(
    finance.getByText('No matching payment proofs.', { exact: true }),
    'finance:gcash-queue-refreshed'
  );
  await hidden(
    finance.getByRole('button', { name: 'Approve and post payment', exact: true }),
    'finance:gcash-approve-action-hidden'
  );
  await screenshot(finance, '26-finance-gcash-approved');

  await parent.goto('/parent/dashboard');
  await visible(parent.getByText('FULLY PAID', { exact: true }).first(), 'parent:fully-paid');
  await screenshot(parent, '27-parent-fully-paid');
  await parent.goto('/parent/payment-submissions');
  const approvedRow = parent.getByRole('row').filter({ hasText: gcashReference });
  await visible(approvedRow, 'parent:gcash-approved-row');
  await screenshot(parent, '28-parent-gcash-approved');
  const approvedReceiptLink = approvedRow.getByRole('link', {
    name: /View system-generated receipt/,
  });
  await approvedReceiptLink.click();
  await parent.waitForURL(/\/parent\/receipts\//, { timeout: 30_000 });
  await visible(
    parent.getByRole('heading', { name: /System-generated payment receipt/i }),
    'parent:system-receipt'
  );
  await visible(
    parent.getByText(
      'This system-generated receipt records a payment verified in the school fees monitoring system. It is not an official tax receipt.',
      { exact: false }
    ),
    'parent:receipt-disclaimer'
  );
  await screenshot(parent, '29-parent-system-generated-receipt');

  const adminSubmissions = await jsonRequest(
    admin.request,
    'GET',
    `/api/admin/payment-submissions?search=${encodeURIComponent(gcashReference)}`
  );
  const approvedSubmission = firstItem(adminSubmissions);
  assert.ok(approvedSubmission?.approvedPaymentId, 'approved submission has no payment id');
  await jsonRequest(
    admin.request,
    'POST',
    `/api/admin/payments/${approvedSubmission.approvedPaymentId}/reverse`,
    {
      reason: 'Desktop QA GCash cleanup reversal',
    }
  );
  record('finance:gcash-reversed-for-cleanup', { paymentId: approvedSubmission.approvedPaymentId });

  children = await jsonRequest(parent.request, 'GET', '/api/portal/parent/children');
  child = children.find((item) => item.studentId === child.studentId);
  assert.ok(
    child && child.outstandingBalanceCentavos > 0,
    'GCash cleanup reversal did not restore balance'
  );
  const mayaAmount = Math.min(child.outstandingBalanceCentavos, 12_345);
  const mayaReference = `QA-DESKTOP-MAYA-${suffix}`;
  await parent.goto(`/parent/pay?studentId=${child.studentId}`);
  await parent.getByRole('button', { name: /^MAYA/ }).click();
  await pageReady(parent, parent.getByText(/OSFS Demo Maya Account/), 'parent:maya-destination');
  await screenshot(parent, '30-parent-maya-form');
  await parent.getByLabel('Amount transferred (PHP)').fill((mayaAmount / 100).toFixed(2));
  await parent.getByLabel('Transaction/reference number').fill(mayaReference);
  await parent
    .getByLabel('Transaction date and time')
    .fill(new Date(Date.now() - 60_000).toISOString().slice(0, 16));
  await parent.getByLabel('Screenshot/proof').setInputFiles({
    name: 'fictional-maya-proof.png',
    mimeType: 'image/png',
    buffer: proofBuffer,
  });
  await parent.getByRole('button', { name: 'Submit payment proof', exact: true }).click();
  await visible(parent.getByText('PENDING VERIFICATION', { exact: true }), 'parent:maya-pending');
  await screenshot(parent, '31-parent-maya-pending');

  await finance.goto('/admin/payment-submissions');
  await finance.getByLabel('Search student or reference').fill(mayaReference);
  const mayaRow = finance.getByRole('row').filter({ hasText: mayaReference });
  await visible(mayaRow, 'finance:maya-pending-row');
  await mayaRow.click();
  await pageReady(
    finance,
    finance.getByText(`Reference: ${mayaReference}`, { exact: true }),
    'finance:maya-review'
  );
  await finance
    .getByLabel('Rejection reason (required to reject)')
    .fill('Desktop QA rejection reason.');
  await finance.getByRole('button', { name: 'Reject proof', exact: true }).click();
  await visible(
    finance.getByRole('status').filter({ hasText: 'Payment proof rejected.' }),
    'finance:maya-rejected'
  );
  await visible(
    finance.getByText('No matching payment proofs.', { exact: true }),
    'finance:maya-queue-refreshed'
  );
  await hidden(
    finance.getByRole('button', { name: 'Reject proof', exact: true }),
    'finance:maya-reject-action-hidden'
  );
  await screenshot(finance, '32-finance-maya-rejected');

  await parent.goto('/parent/payment-submissions');
  const rejectedRow = parent.getByRole('row').filter({ hasText: mayaReference });
  await visible(rejectedRow, 'parent:maya-rejected-row');
  await visible(
    rejectedRow.getByText('Desktop QA rejection reason.'),
    'parent:maya-rejection-reason'
  );
  await screenshot(parent, '33-parent-maya-rejected');
  await parent.goto(`/parent/children/${child.studentId}`);
  await visible(
    parent.getByText('WITH REMAINING BALANCE', { exact: true }).first(),
    'parent:maya-balance-unchanged'
  );
  await screenshot(parent, '34-parent-maya-balance-unchanged');

  await admin.goto('/admin/reports');
  await pageReady(
    admin,
    admin.getByRole('heading', { name: 'Financial reports and statements', exact: true }),
    'admin:reports-final-ready'
  );
  await screenshot(admin, '35-admin-reports-final');
  for (const reportPath of [
    '/api/reports/summary',
    '/api/reports/collections',
    '/api/reports/outstanding',
    '/api/reports/reversals',
    '/api/reports/csv',
  ]) {
    const response = await admin.request.get(reportPath);
    assert.equal(response.ok(), true, `${reportPath} failed with ${response.status()}`);
    record(`report:${reportPath}`);
  }

  const anonymousContext = await context();
  const anonymous = await anonymousContext.request.get('/api/admin/payments');
  assert.equal(anonymous.status(), 401);
  const parentAdmin = await parent.request.get('/api/admin/payments');
  assert.equal(parentAdmin.status(), 403);
  const studentParent = await student.request.get('/api/portal/parent/children');
  assert.equal(studentParent.status(), 403);
  record('rbac:anonymous-and-cross-role-denials');

  await jsonRequest(admin.request, 'DELETE', `/api/admin/announcements/${announcement.id}`);
  record('announcement:archived-for-cleanup', { id: announcement.id });
} catch (error) {
  results.failures.push({ name: 'desktop-core-qa', error: error?.stack ?? String(error) });
} finally {
  results.finishedAt = new Date().toISOString();
  await writeFile(`${outDir}/desktop-core-qa-results.json`, JSON.stringify(results, null, 2));
  await Promise.all(contexts.map((value) => value.close().catch(() => undefined)));
  await browser.close();
}

console.log(
  JSON.stringify(
    {
      screenshots: results.screenshots.length,
      assertions: results.assertions.length,
      failures: results.failures,
      results: `${outDir}/desktop-core-qa-results.json`,
    },
    null,
    2
  )
);

if (results.failures.length > 0) process.exitCode = 1;
