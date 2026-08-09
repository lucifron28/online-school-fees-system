import { expect, test, type APIResponse, type Page } from '@playwright/test';

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

      const assessment = await jsonResponse<{ id: string }>(
        await admin.request.post(`/api/admin/students/${createdStudent.id}/assessments`, {
          data: { feeStructureId: structures[0].id },
        })
      );
      expect(assessment.id).toBeTruthy();

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
      const studentAccount = await jsonResponse<{ student: { studentNumber: string } }>(
        await student.request.get('/api/portal/student/account')
      );
      expect(studentAccount.student.studentNumber).toBe('DEMO-0001');
      expect(studentAccount.student.studentNumber).not.toBe(createdStudent.studentNumber);

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
      await expect(finance.getByText('FINANCE STAFF', { exact: true })).toBeVisible();
      await expect(finance.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
      await expect(finance.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0);
      const studentSelect = finance.getByLabel('Student');
      await expect(studentSelect).toBeVisible();
      const seededStudentOption = studentSelect.locator('option').filter({ hasText: 'DEMO-0001' });
      await expect(seededStudentOption).toHaveCount(1);
      const seededStudentId = await seededStudentOption.getAttribute('value');
      expect(seededStudentId).toBeTruthy();
      await studentSelect.selectOption(seededStudentId!);
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
      await expect(parent.getByRole('heading', { name: 'Payment history' })).toBeVisible({
        timeout: 15_000,
      });
      const parentPaymentRow = parent.getByRole('row').filter({ hasText: receiptNumber });
      await expect(parentPaymentRow).toBeVisible();
      await parentPaymentRow.getByRole('link', { name: 'View receipt', exact: true }).click();
      await expect(parent.getByText(browserReference, { exact: true })).toBeVisible();

      const student = await studentContext.newPage();
      await login(student, 'student', 'student@demo.school');
      await expect(student.getByText(/Welcome, Alex!/)).toBeVisible();
      await student.getByRole('link', { name: 'My Account', exact: true }).click();
      await expect(student.getByText('Finance-posted fee assessments')).toBeVisible();
      await student.getByRole('link', { name: 'Payment History', exact: true }).click();
      await expect(student.getByRole('heading', { name: 'Payment history' })).toBeVisible();
      const studentPaymentRow = student.getByRole('row').filter({ hasText: receiptNumber });
      await expect(studentPaymentRow).toBeVisible();
      await studentPaymentRow.getByRole('link', { name: 'View receipt', exact: true }).click();
      await expect(student.getByText(browserReference, { exact: true })).toBeVisible();
    } finally {
      await Promise.all([financeContext.close(), parentContext.close(), studentContext.close()]);
    }
  });
});
