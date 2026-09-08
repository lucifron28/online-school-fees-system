import { expect, test } from '@playwright/test';
import { fictionalPaymentProof } from '../../fixtures/fictional-payment-proof';
import { formatCentavos } from '@/lib/utils/currency';
import {
  assertChildBalance,
  login,
  logout,
  openParentChild,
  presentationPause,
  readPaymentFormBalance,
  saveRecording,
} from './helpers';

const GCashStudent = 'DEMO-0002';
const MayaStudent = 'DEMO-0001';
const OtcStudent = 'DEMO-0006';
const paymentDate = '2026-08-01T09:00';

async function fillAndSubmitProof(
  page: Parameters<typeof openParentChild>[0],
  channel: 'GCASH' | 'MAYA',
  amount: string,
  reference: string
) {
  const linkedChild = page.getByLabel('Linked child');
  await expect(linkedChild).toBeVisible();
  await expect(linkedChild).toHaveValue(/.+/);
  await page.getByRole('button', { name: new RegExp(`^${channel}`) }).click();
  await expect(
    page.getByText(channel === 'GCASH' ? /OSFS Demo GCash Account/ : /OSFS Demo Maya Account/)
  ).toBeVisible();
  const beforeBalance = await readPaymentFormBalance(page);

  await page.getByLabel('Amount transferred (PHP)').fill(amount);
  await page.getByLabel('Transaction/reference number').fill(reference);
  await page.getByLabel('Transaction date and time').fill(paymentDate);
  await page.getByLabel('Payment screenshot').setInputFiles({
    name: `fictional-${channel.toLowerCase()}-transfer.png`,
    mimeType: 'image/png',
    buffer: fictionalPaymentProof,
  });
  await presentationPause(page, 700);
  await page.getByRole('button', { name: 'Submit payment proof', exact: true }).click();
  await expect(page.getByText('PENDING VERIFICATION', { exact: true })).toBeVisible();
  await expect(
    page.getByText('The balance will remain unchanged until Finance Staff approves it.')
  ).toBeVisible();

  return beforeBalance;
}

async function reviewPaymentProof(
  page: Parameters<typeof openParentChild>[0],
  reference: string,
  action: 'approve' | 'reject'
) {
  await page.goto('/admin/payment-submissions');
  await expect(page.getByRole('heading', { name: 'GCash and Maya payment proofs' })).toBeVisible();
  await page.getByLabel('Search student or reference').fill(reference);

  const row = page.getByRole('row').filter({ hasText: reference });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByText(`Reference: ${reference}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Payment proof for/ })).toBeVisible();
  await expect(page.getByText(/Historical destination:/)).toBeVisible();
  await presentationPause(page);

  if (action === 'approve') {
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Approve and post payment', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Payment proof approved and posted.');
  } else {
    await page
      .getByLabel('Rejection reason (required to reject)')
      .fill('The fictional transfer confirmation could not be verified.');
    await page.getByRole('button', { name: 'Reject proof', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Payment proof rejected.');
  }
}

test.describe('core workflow recordings', () => {
  test('01 — parent GCash proof, Finance approval, and parent receipt', async ({
    page,
  }, testInfo) => {
    const startedAt = Date.now();
    await login(page, 'parent', 'parent@demo.school');
    const studentId = await openParentChild(page, GCashStudent);
    await expect(page.getByText('Finance-posted assessment breakdown')).toBeVisible();
    const beforeCentavos = 5_000_000;
    await assertChildBalance(page, beforeCentavos);
    await presentationPause(page);

    await page.getByRole('link', { name: 'Pay', exact: true }).click();
    await expect(page).toHaveURL(/\/parent\/pay/);
    const beforeBalance = await fillAndSubmitProof(page, 'GCASH', '1000.00', 'RECORD-GCASH-2026');
    expect(beforeBalance).toBe(formatCentavos(beforeCentavos));
    await presentationPause(page);

    await page.goto(`/parent/children/${studentId}`);
    await assertChildBalance(page, beforeCentavos);
    await presentationPause(page);
    await logout(page, 'parent');

    await login(page, 'admin', 'finance@demo.school');
    await reviewPaymentProof(page, 'RECORD-GCASH-2026', 'approve');
    await presentationPause(page);
    await logout(page, 'admin');

    await login(page, 'parent', 'parent@demo.school');
    await openParentChild(page, GCashStudent);
    await assertChildBalance(page, 4_900_000);
    await expect(page.getByText('WITH REMAINING BALANCE', { exact: true }).first()).toBeVisible();
    await presentationPause(page);
    await page.getByRole('link', { name: 'View full history', exact: true }).click();
    await expect(page).toHaveURL(/\/parent\/history/);
    const approvedRow = page
      .getByRole('row')
      .filter({ hasText: formatCentavos(100_000) })
      .filter({ hasText: 'GCASH' })
      .filter({ hasText: 'POSTED' });
    await expect(approvedRow).toContainText('Bianca Reyes');
    await expect(approvedRow).toContainText('GCASH');
    await approvedRow.getByRole('link', { name: 'View receipt', exact: true }).click();
    await expect(page).toHaveURL(/\/parent\/receipts\//);
    await expect(
      page.getByRole('heading', { name: /System-generated payment receipt/i })
    ).toBeVisible();
    await expect(
      page.getByText(
        'This system-generated receipt records a payment verified in the school fees monitoring system. It is not an official tax receipt.',
        { exact: false }
      )
    ).toBeVisible();
    await presentationPause(page, 1400);
    await saveRecording(page, testInfo, '01-gcash-payment-approval.webm', startedAt);
  });

  test('02 — parent Maya proof, Finance rejection, and unchanged balance', async ({
    page,
  }, testInfo) => {
    const startedAt = Date.now();
    await login(page, 'parent', 'parent@demo.school');
    const studentId = await openParentChild(page, MayaStudent);
    const beforeCentavos = 2_000_000;
    await assertChildBalance(page, beforeCentavos);
    await presentationPause(page);

    await page.getByRole('link', { name: 'Pay', exact: true }).click();
    await expect(page).toHaveURL(/\/parent\/pay/);
    const beforeBalance = await fillAndSubmitProof(page, 'MAYA', '500.00', 'RECORD-MAYA-2026');
    expect(beforeBalance).toBe(formatCentavos(beforeCentavos));
    await presentationPause(page);

    await page.goto(`/parent/children/${studentId}`);
    await assertChildBalance(page, beforeCentavos);
    await presentationPause(page);
    await logout(page, 'parent');

    await login(page, 'admin', 'finance@demo.school');
    await reviewPaymentProof(page, 'RECORD-MAYA-2026', 'reject');
    await presentationPause(page);
    await logout(page, 'admin');

    await login(page, 'parent', 'parent@demo.school');
    await openParentChild(page, MayaStudent);
    await assertChildBalance(page, beforeCentavos);
    await expect(page.getByText('WITH REMAINING BALANCE', { exact: true }).first()).toBeVisible();
    await presentationPause(page);
    await page.goto('/parent/payment-submissions');
    const rejectedRow = page.getByRole('row').filter({ hasText: 'RECORD-MAYA-2026' });
    await expect(rejectedRow).toContainText('MAYA');
    await expect(rejectedRow).toContainText('REJECTED');
    await expect(rejectedRow).toContainText(
      'The fictional transfer confirmation could not be verified.'
    );
    await expect(
      rejectedRow.getByRole('link', { name: /View system-generated receipt/ })
    ).toHaveCount(0);
    await presentationPause(page, 1400);
    await saveRecording(page, testInfo, '02-maya-payment-rejection.webm', startedAt);
  });

  test('03 — Finance OTC cash payment, updated balance, and receipt', async ({
    page,
  }, testInfo) => {
    const startedAt = Date.now();
    await login(page, 'admin', 'finance@demo.school');
    await page.goto('/admin/payments/manual');
    await expect(
      page.getByRole('heading', { name: 'Over-the-counter payment processing', exact: true })
    ).toBeVisible();
    await page.getByLabel('Search students').fill(OtcStudent);
    const option = page.getByRole('option', { name: new RegExp(OtcStudent) }).first();
    await expect(option).toBeVisible();
    await option.click();
    await expect(page.getByText('Authoritative current balance')).toBeVisible();
    await expect(page.getByText(formatCentavos(7_000_000), { exact: true })).toBeVisible();
    await presentationPause(page);

    await page.getByLabel('Payment method').selectOption('CASH');
    await page.getByLabel('Amount received (PHP)').fill('5000.00');
    await page.getByLabel('Deposit/reference no. (optional)').fill('RECORD-OTC-2026');
    await presentationPause(page, 700);
    await page.getByRole('button', { name: 'Post payment and issue receipt', exact: true }).click();
    await expect(page.getByText('Payment posted', { exact: true })).toBeVisible();
    await expect(
      page.getByText(`${formatCentavos(500_000)} received`, { exact: true })
    ).toBeVisible();
    const receiptNumber = page.getByText(/OSFS-\d{4}-\d{6}/).first();
    await expect(receiptNumber).toBeVisible();
    await presentationPause(page);

    await page.getByRole('link', { name: 'View transaction', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/transactions\//);
    await expect(page.getByText('System-generated payment receipt', { exact: true })).toBeVisible();
    await expect(page.getByText('Payment method', { exact: true }).locator('..')).toContainText(
      'CASH'
    );
    await expect(page.getByText('Current student balance:', { exact: false })).toContainText(
      formatCentavos(6_500_000)
    );
    await expect(
      page.getByText('Remaining Balance After Payment:', { exact: false })
    ).toContainText(formatCentavos(6_500_000));
    await expect(page.getByText('Reference: RECORD-OTC-2026', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Receipt PDF', exact: true })).toBeVisible();
    await presentationPause(page, 1600);
    await saveRecording(page, testInfo, '03-otc-cash-payment.webm', startedAt);
  });
});
