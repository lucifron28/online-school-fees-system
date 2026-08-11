import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { fictionalPaymentProof } from '../fixtures/fictional-payment-proof';
import { formatCentavos } from '@/lib/utils/currency';

const PASSWORD = 'DemoPass123!';

async function login(page: Page, portal: 'admin' | 'parent' | 'student', email: string) {
  await page.goto(`/login/${portal}`);
  const emailLabel =
    portal === 'admin'
      ? 'Email / Admin ID'
      : portal === 'parent'
        ? 'Parent Email / Account ID'
        : 'Student Email / Account ID';
  await page.getByLabel(emailLabel).fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(new RegExp(`/${portal === 'admin' ? 'admin' : portal}/dashboard$`), {
    timeout: 15_000,
  });
}

async function jsonResponse<T>(response: APIResponse) {
  expect(response.ok(), `${response.url()}`).toBe(true);
  return (await response.json()) as T;
}

test.describe('authenticated financial workflow', () => {
  test('admin, finance, parent, and student complete an owned demo workflow', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const suffix = Date.now();
    const adminContext = await browser.newContext();
    const financeContext = await browser.newContext();
    const parentContext = await browser.newContext();
    const studentContext = await browser.newContext();
    const anonymousContext = await browser.newContext();

    try {
      const admin = await adminContext.newPage();
      await login(admin, 'admin', 'admin@demo.school');

      const options = await jsonResponse<{
        schoolYears: Array<{ id: string; status: string }>;
        gradeLevels: Array<{ id: string; code: string }>;
      }>(await admin.request.get('/api/admin/fee-options'));
      const activeYear = options.schoolYears.find((year) => year.status === 'ACTIVE');
      const gradeSeven = options.gradeLevels.find((grade) => grade.code === 'G7');
      expect(activeYear).toBeDefined();
      expect(gradeSeven).toBeDefined();

      const sections = await jsonResponse<Array<{ id: string; code: string }>>(
        await admin.request.get('/api/admin/sections')
      );
      const section = sections.find((item) => item.code === 'G7-A');
      expect(section).toBeDefined();

      const createdStudent = await jsonResponse<{
        id: string;
        studentNumber: string;
      }>(
        await admin.request.post('/api/admin/students', {
          data: {
            studentNumber: `E2E-${suffix}`,
            firstName: 'E2E',
            lastName: 'Student',
            email: `e2e.student.${suffix}@schoolfees.example.com`,
            userId: null,
            gradeLevelId: gradeSeven!.id,
            sectionId: section!.id,
            schoolYearId: activeYear!.id,
            status: 'ACTIVE',
          },
        })
      );
      expect(createdStudent.studentNumber).toBe(`E2E-${suffix}`);

      const createdGuardian = await jsonResponse<{ id: string }>(
        await admin.request.post('/api/admin/guardians', {
          data: {
            firstName: 'E2E',
            lastName: 'Guardian',
            email: `e2e.guardian.${suffix}@schoolfees.example.com`,
            phone: '+63 917 555 9090',
            relationship: 'Parent',
            address: 'Fictional E2E address, Manila',
            userId: null,
          },
        })
      );
      await jsonResponse(
        await admin.request.post(`/api/admin/students/${createdStudent.id}/guardians`, {
          data: { guardianId: createdGuardian.id, isPrimary: true },
        })
      );

      const parentGuardians = await jsonResponse<Array<{ id: string; email: string }>>(
        await admin.request.get('/api/admin/guardians?search=parent@demo.school')
      );
      const parentGuardian = parentGuardians.find(
        (guardian) => guardian.email === 'parent@demo.school'
      );
      expect(parentGuardian).toBeDefined();
      await jsonResponse(
        await admin.request.post(`/api/admin/students/${createdStudent.id}/guardians`, {
          data: { guardianId: parentGuardian!.id, isPrimary: false },
        })
      );
      const linkedStudents = await jsonResponse<Array<{ id: string }>>(
        await admin.request.get(`/api/admin/guardians/${parentGuardian!.id}/students`)
      );
      expect(linkedStudents.some((student) => student.id === createdStudent.id)).toBe(true);

      const structures = await jsonResponse<
        Array<{ id: string; gradeLevelId: string; status: string; items: unknown[] }>
      >(
        await admin.request.get(
          `/api/admin/fee-structures?schoolYearId=${activeYear!.id}&gradeLevelId=${gradeSeven!.id}&status=ACTIVE`
        )
      );
      expect(structures.length).toBeGreaterThan(0);
      expect(structures[0].items.length).toBeGreaterThan(0);

      const assessment = await jsonResponse<{ id: string; dueDate: string | null }>(
        await admin.request.post(`/api/admin/students/${createdStudent.id}/assessments`, {
          data: { feeStructureId: structures[0].id },
        })
      );
      expect(assessment.id).toBeTruthy();
      expect(assessment.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const finance = await financeContext.newPage();
      await login(finance, 'admin', 'finance@demo.school');
      const payment = await jsonResponse<{
        id: string;
        receipt: { id: string; status: string };
        remainingBalanceCentavos: number;
      }>(
        await finance.request.post('/api/admin/payments', {
          data: {
            studentId: createdStudent.id,
            amountCentavos: 10_000_00,
            paymentMethod: 'CASH',
            referenceNumber: `E2E-CASH-${suffix}`,
            idempotencyKey: `e2e-cash-${suffix}`,
          },
        })
      );
      expect(payment.receipt.status).toBe('ACTIVE');
      expect(payment.remainingBalanceCentavos).toBe(60_000_00);

      const parent = await parentContext.newPage();
      await login(parent, 'parent', 'parent@demo.school');
      const children = await jsonResponse<Array<{ studentId: string; studentNumber: string }>>(
        await parent.request.get('/api/portal/parent/children')
      );
      expect(
        children.some((child) => child.studentId === createdStudent.id),
        `Parent children: ${children.map((child) => child.studentNumber).join(', ')}`
      ).toBe(true);
      await parent.goto(`/parent/children/${createdStudent.id}`);
      await expect(parent.getByText(assessment.dueDate!, { exact: true }).first()).toBeVisible();
      const parentPaymentsBeforeOnline = await jsonResponse<Array<{ id: string }>>(
        await parent.request.get('/api/portal/parent/payments')
      );
      expect(parentPaymentsBeforeOnline.some((item) => item.id === payment.id)).toBe(true);

      const checkout = await jsonResponse<{ paymentReference: string; status: string }>(
        await parent.request.post('/api/portal/parent/checkouts', {
          data: {
            studentId: createdStudent.id,
            amountCentavos: 5_000_00,
            paymentChannel: 'GCash',
            idempotencyKey: `e2e-checkout-${suffix}`,
          },
        })
      );
      expect(checkout.status).toBe('CREATED');
      const callback = {
        paymentReference: checkout.paymentReference,
        eventId: `e2e-event-${suffix}`,
        idempotencyKey: `e2e-callback-${suffix}`,
        status: 'SUCCESS',
      } as const;
      const callbackResult = await jsonResponse<{ paymentId: string; duplicatePrevented: boolean }>(
        await parent.request.post('/api/payments/mock-callback', { data: callback })
      );
      const replayResult = await jsonResponse<{ paymentId: string; duplicatePrevented: boolean }>(
        await parent.request.post('/api/payments/mock-callback', { data: callback })
      );
      expect(callbackResult.paymentId).toBeTruthy();
      expect(callbackResult.duplicatePrevented).toBe(false);
      expect(replayResult.paymentId).toBe(callbackResult.paymentId);
      expect(replayResult.duplicatePrevented).toBe(true);

      const student = await studentContext.newPage();
      await login(student, 'student', 'student@demo.school');
      const studentAccount = await jsonResponse<{
        student: { studentNumber: string };
        assessments: Array<{ dueDate: string | null }>;
      }>(await student.request.get('/api/portal/student/account'));
      expect(studentAccount.student.studentNumber).toBe('DEMO-0001');
      expect(studentAccount.student.studentNumber).not.toBe(createdStudent.studentNumber);
      const studentDueDate = studentAccount.assessments.find(
        (item) => item.dueDate !== null
      )?.dueDate;
      expect(studentDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      await student.goto('/student/account');
      await expect(student.getByText(studentDueDate!, { exact: true }).first()).toBeVisible();

      const reversed = await jsonResponse<{
        paymentStatus: string;
        receiptStatus: string;
        balanceCentavos: number;
      }>(
        await admin.request.post(`/api/admin/payments/${payment.id}/reverse`, {
          data: { reason: 'E2E audit walkthrough reversal' },
        })
      );
      expect(reversed.paymentStatus).toBe('REVERSED');
      expect(reversed.receiptStatus).toBe('VOIDED');
      expect(reversed.balanceCentavos).toBe(65_000_00);

      const receiptPdf = await finance.request.get(`/api/receipts/${payment.receipt.id}/pdf`);
      expect(receiptPdf.status()).toBe(200);
      expect(receiptPdf.headers()['content-type']).toContain('application/pdf');
      expect((await receiptPdf.body()).length).toBeGreaterThan(100);

      const reversalReport = await jsonResponse<{ items: Array<{ paymentId: string }> }>(
        await admin.request.get('/api/reports/reversals')
      );
      expect(reversalReport.items.some((item) => item.paymentId === payment.id)).toBe(true);

      const anonymous = await anonymousContext.request.get('/api/admin/payments');
      expect(anonymous.status()).toBe(401);
      const parentAdminRequest = await parent.request.get('/api/admin/payments');
      expect(parentAdminRequest.status()).toBe(403);
      const studentParentRequest = await student.request.get('/api/portal/parent/children');
      expect(studentParentRequest.status()).toBe(403);
    } finally {
      await Promise.all([
        adminContext.close(),
        financeContext.close(),
        parentContext.close(),
        studentContext.close(),
        anonymousContext.close(),
      ]);
    }
  });

  test('browser-only UI workflow posts one seeded payment visible to every owner portal', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const suffix = Date.now();
    const financeContext = await browser.newContext();
    const parentContext = await browser.newContext();
    const studentContext = await browser.newContext();

    try {
      const finance = await financeContext.newPage();
      await login(finance, 'admin', 'finance@demo.school');
      await finance.goto('/admin/payments/manual');
      await expect(
        finance.getByRole('link', { name: 'Finance Staff Portal', exact: true })
      ).toBeVisible();
      await expect(finance.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
      await expect(finance.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0);
      const studentSearch = finance.getByLabel('Search students');
      await expect(studentSearch).toBeVisible();
      await studentSearch.fill('DEMO-0001');
      await expect(finance.getByRole('option', { name: /DEMO-0001/ }).first()).toBeVisible();
      await finance
        .getByRole('option', { name: /DEMO-0001/ })
        .first()
        .click();
      await expect(finance.getByText('Authoritative current balance')).toBeVisible();
      await finance.getByLabel('Payment method').selectOption('CASH');
      await finance.getByLabel('Amount received (PHP)').fill('10.00');
      const browserReference = `BROWSER-${suffix}`;
      await finance.getByLabel('Deposit/reference no. (optional)').fill(browserReference);
      await finance
        .getByRole('button', { name: 'Post payment and issue receipt', exact: true })
        .click();
      await expect(finance.getByText('Payment posted', { exact: true })).toBeVisible();
      const receiptNumber = (
        await finance
          .getByText(/OSFS-\d{4}-\d{6}/)
          .first()
          .innerText()
      ).trim();
      expect(receiptNumber).toMatch(/^OSFS-\d{4}-\d{6}$/);
      await finance.getByRole('link', { name: 'View transaction', exact: true }).click();
      await expect(finance).toHaveURL(/\/admin\/transactions\//, { timeout: 15_000 });
      const receiptLink = finance.getByRole('link', { name: 'Receipt PDF', exact: true });
      await expect(receiptLink).toBeVisible();
      await expect(receiptLink).toHaveAttribute('href', /\/api\/receipts\/.*\/pdf/);
      const [receiptPopup] = await Promise.all([
        finance.waitForEvent('popup'),
        receiptLink.click(),
      ]);
      await receiptPopup.close();

      const parent = await parentContext.newPage();
      await login(parent, 'parent', 'parent@demo.school');
      await expect(parent.getByText(/DEMO-0001/)).toBeVisible({ timeout: 15_000 });
      await parent.getByRole('link', { name: 'Payment History', exact: true }).click();
      await expect(
        parent.locator('main').getByRole('heading', { name: 'Payment history' })
      ).toBeVisible({ timeout: 15_000 });
      const parentPaymentRow = parent.getByRole('row').filter({ hasText: receiptNumber });
      await expect(parentPaymentRow).toBeVisible({ timeout: 15_000 });
      await parentPaymentRow.getByRole('link', { name: 'View receipt', exact: true }).click();
      await expect(parent.getByText(browserReference, { exact: true })).toBeVisible({
        timeout: 30_000,
      });

      const student = await studentContext.newPage();
      await login(student, 'student', 'student@demo.school');
      await expect(student.getByText(/Welcome, Alex!/)).toBeVisible();
      await student.getByRole('link', { name: 'My Account', exact: true }).click();
      await expect(student.getByText('Finance-posted fee assessments')).toBeVisible();
      await student.getByRole('link', { name: 'Payment History', exact: true }).click();
      await expect(
        student.locator('main').getByRole('heading', { name: 'Payment history' })
      ).toBeVisible();
      const studentPaymentRow = student.getByRole('row').filter({ hasText: receiptNumber });
      await expect(studentPaymentRow).toBeVisible({ timeout: 15_000 });
      await studentPaymentRow.getByRole('link', { name: 'View receipt', exact: true }).click();
      await expect(student.getByText(browserReference, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await Promise.all([financeContext.close(), parentContext.close(), studentContext.close()]);
    }
  });

  test('browser-only UI settles withdrawn debt and preserves the first receipt balance', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const suffix = Date.now();
    const financeContext = await browser.newContext();

    try {
      const finance = await financeContext.newPage();
      await login(finance, 'admin', 'finance@demo.school');
      await finance.goto('/admin/payments/manual');

      const studentSearch = finance.getByLabel('Search students');
      await expect(studentSearch).toBeVisible();
      await studentSearch.fill('DEMO-0012');
      const withdrawnOption = finance.getByRole('option', { name: /DEMO-0012/ }).first();
      await expect(withdrawnOption).toBeVisible();
      await expect(withdrawnOption).toContainText('WITHDRAWN');
      await withdrawnOption.click();
      await expect(finance.getByText('Authoritative current balance')).toBeVisible();
      await expect(finance.getByText('₱70,000.00')).toBeVisible();

      await finance.getByLabel('Payment method').selectOption('CASH');
      await finance.getByLabel('Amount received (PHP)').fill('10000.00');
      await finance.getByLabel('Deposit/reference no. (optional)').fill(`R3-FIRST-${suffix}`);
      await finance
        .getByRole('button', { name: 'Post payment and issue receipt', exact: true })
        .click();
      await expect(finance.getByText('Payment posted', { exact: true })).toBeVisible();
      await finance.getByRole('link', { name: 'View transaction', exact: true }).click();
      await expect(finance).toHaveURL(/\/admin\/transactions\//, { timeout: 15_000 });
      const firstTransactionUrl = finance.url();
      await expect(
        finance.getByText('Remaining Balance After Payment:', { exact: false }).locator('..')
      ).toContainText('₱60,000.00');

      await finance.goto('/admin/payments/manual');
      await finance.getByLabel('Search students').fill('DEMO-0012');
      await finance
        .getByRole('option', { name: /DEMO-0012/ })
        .first()
        .click();
      await finance.getByLabel('Payment method').selectOption('CASH');
      await finance.getByLabel('Amount received (PHP)').fill('5000.00');
      await finance.getByLabel('Deposit/reference no. (optional)').fill(`R3-SECOND-${suffix}`);
      await finance
        .getByRole('button', { name: 'Post payment and issue receipt', exact: true })
        .click();
      await expect(finance.getByText('Payment posted', { exact: true })).toBeVisible();

      await finance.goto(firstTransactionUrl);
      await expect(finance.getByText('Current student balance:', { exact: false })).toContainText(
        '₱55,000.00'
      );
      await expect(
        finance.getByText('Remaining Balance After Payment:', { exact: false }).locator('..')
      ).toContainText('₱60,000.00');
    } finally {
      await financeContext.close();
    }
  });

  test('browser-only UI verifies a manual GCash proof and shows the system-generated receipt', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const suffix = Date.now();
    const adminContext = await browser.newContext();
    const parentContext = await browser.newContext();
    const financeContext = await browser.newContext();

    try {
      const admin = await adminContext.newPage();
      await login(admin, 'admin', 'admin@demo.school');
      const announcementTitle = `E2E payment update ${suffix}`;
      const announcement = await jsonResponse<{ id: string }>(
        await admin.request.post('/api/admin/announcements', {
          data: {
            title: announcementTitle,
            body: 'Fictional payment verification hours are available in the parent portal.',
            audience: 'PARENT_AND_STUDENT',
            status: 'PUBLISHED',
            publishAt: new Date(Date.now() - 60_000).toISOString(),
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          },
        })
      );
      expect(announcement.id).toBeTruthy();

      const parent = await parentContext.newPage();
      await login(parent, 'parent', 'parent@demo.school');
      const children = await jsonResponse<
        Array<{ studentId: string; studentNumber: string; outstandingBalanceCentavos: number }>
      >(await parent.request.get('/api/portal/parent/children'));
      const child = children.find((item) => item.outstandingBalanceCentavos > 0);
      expect(child).toBeDefined();
      const amount = child!.outstandingBalanceCentavos;
      const reference = `E2E-MANUAL-GCASH-${suffix}`;

      await expect(parent.getByText(announcementTitle, { exact: true })).toBeVisible();
      await expect(
        parent.getByText('WITH REMAINING BALANCE', { exact: true }).first()
      ).toBeVisible();
      await parent.goto(`/parent/pay?studentId=${child!.studentId}`);
      await expect(
        parent.getByRole('heading', { name: 'Submit GCash or Maya payment proof', exact: true })
      ).toBeVisible();
      await parent.getByRole('button', { name: /^GCASH/ }).click();
      await expect(parent.getByText(/OSFS Demo GCash Account/)).toBeVisible();
      await parent.getByLabel('Amount transferred (PHP)').fill((amount / 100).toFixed(2));
      await parent.getByLabel('Transaction/reference number').fill(reference);
      await parent
        .getByLabel('Transaction date and time')
        .fill(new Date(Date.now() - 60_000).toISOString().slice(0, 16));
      await parent.getByLabel('Screenshot/proof').setInputFiles({
        name: 'fictional-payment-proof.png',
        mimeType: 'image/png',
        buffer: fictionalPaymentProof,
      });
      await parent.getByRole('button', { name: 'Submit payment proof', exact: true }).click();
      await expect(parent.getByText('PENDING VERIFICATION', { exact: true })).toBeVisible();
      await expect(
        parent.getByText('The balance will remain unchanged until Finance Staff approves it.')
      ).toBeVisible();

      const finance = await financeContext.newPage();
      await login(finance, 'admin', 'finance@demo.school');
      await finance.goto('/admin/payment-submissions');
      await Promise.all([
        finance.waitForResponse((response) => {
          if (!response.url().includes('/api/admin/payment-submissions') || !response.ok()) {
            return false;
          }
          return new URL(response.url()).searchParams.get('search') === reference;
        }),
        finance.getByLabel('Search student or reference').fill(reference),
      ]);
      const pendingRow = finance.getByRole('row').filter({ hasText: reference });
      await expect(pendingRow).toBeVisible({ timeout: 15_000 });
      await pendingRow.click();
      await expect(finance.getByText(`Reference: ${reference}`, { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      finance.once('dialog', (dialog) => dialog.accept());
      await finance.getByRole('button', { name: 'Approve and post payment', exact: true }).click();
      await expect(finance.getByRole('status')).toContainText('Payment proof approved and posted.');

      await parent.goto('/parent/dashboard');
      await expect(parent.getByText('FULLY PAID', { exact: true }).first()).toBeVisible();
      await parent.goto('/parent/payment-submissions');
      const approvedRow = parent.getByRole('row').filter({ hasText: reference });
      await expect(approvedRow).toContainText('APPROVED', { timeout: 15_000 });
      await approvedRow.getByRole('link', { name: /View system-generated receipt/ }).click();
      await expect(parent).toHaveURL(/\/parent\/receipts\//);
      await expect(
        parent.getByRole('heading', { name: /System-generated payment receipt/i })
      ).toBeVisible();
      await expect(
        parent.getByText(
          'This system-generated receipt records a payment verified in the school fees monitoring system. It is not an official tax receipt.',
          { exact: false }
        )
      ).toBeVisible();
    } finally {
      await Promise.all([adminContext.close(), parentContext.close(), financeContext.close()]);
    }
  });

  test('browser-only UI rejects a manual Maya proof without changing the balance', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const suffix = Date.now();
    const parentContext = await browser.newContext();
    const financeContext = await browser.newContext();

    try {
      const parent = await parentContext.newPage();
      await login(parent, 'parent', 'parent@demo.school');
      const children = await jsonResponse<
        Array<{ studentId: string; studentNumber: string; outstandingBalanceCentavos: number }>
      >(await parent.request.get('/api/portal/parent/children'));
      const child = children.find((item) => item.outstandingBalanceCentavos > 0);
      expect(child).toBeDefined();
      const beforeBalance = child!.outstandingBalanceCentavos;
      const amount = Math.min(beforeBalance, 12_345);
      const reference = `E2E-MANUAL-MAYA-${suffix}`;

      await parent.goto(`/parent/pay?studentId=${child!.studentId}`);
      await parent.getByRole('button', { name: /^MAYA/ }).click();
      await expect(parent.getByText(/OSFS Demo Maya Account/)).toBeVisible();
      await parent.getByLabel('Amount transferred (PHP)').fill((amount / 100).toFixed(2));
      await parent.getByLabel('Transaction/reference number').fill(reference);
      await parent
        .getByLabel('Transaction date and time')
        .fill(new Date(Date.now() - 60_000).toISOString().slice(0, 16));
      await parent.getByLabel('Screenshot/proof').setInputFiles({
        name: 'fictional-maya-proof.png',
        mimeType: 'image/png',
        buffer: fictionalPaymentProof,
      });
      await parent.getByRole('button', { name: 'Submit payment proof', exact: true }).click();
      await expect(parent.getByText('PENDING VERIFICATION', { exact: true })).toBeVisible();

      const finance = await financeContext.newPage();
      await login(finance, 'admin', 'finance@demo.school');
      await finance.goto('/admin/payment-submissions');
      await Promise.all([
        finance.waitForResponse((response) => {
          if (!response.url().includes('/api/admin/payment-submissions') || !response.ok()) {
            return false;
          }
          return new URL(response.url()).searchParams.get('search') === reference;
        }),
        finance.getByLabel('Search student or reference').fill(reference),
      ]);
      const pendingRow = finance.getByRole('row').filter({ hasText: reference });
      await expect(pendingRow).toBeVisible({ timeout: 15_000 });
      await pendingRow.click();
      await finance
        .getByLabel('Rejection reason (required to reject)')
        .fill('The fictional proof needs a clearer transfer reference.');
      await finance.getByRole('button', { name: 'Reject proof', exact: true }).click();
      await expect(finance.getByRole('status')).toContainText('Payment proof rejected.');

      await parent.goto('/parent/payment-submissions');
      await expect(
        parent.getByRole('heading', { name: 'Payment proof submissions', exact: true })
      ).toBeVisible();
      const rejectedRow = parent.getByRole('row').filter({ hasText: reference });
      await expect(rejectedRow).toContainText('REJECTED', { timeout: 30_000 });
      await expect(rejectedRow).toContainText(
        'The fictional proof needs a clearer transfer reference.'
      );
      await parent.goto(`/parent/children/${child!.studentId}`);
      await expect(
        parent.getByText(formatCentavos(beforeBalance), { exact: true }).first()
      ).toBeVisible();
      await expect(
        parent.getByText('WITH REMAINING BALANCE', { exact: true }).first()
      ).toBeVisible();
    } finally {
      await Promise.all([parentContext.close(), financeContext.close()]);
    }
  });
});
