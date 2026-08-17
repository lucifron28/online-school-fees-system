import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseInstance } from '@/db';
import { getCronAuthorizationFailure } from '@/lib/cron';
import { getServerEnv } from '@/lib/env';
import {
  assertMockPaymentHarnessEnabled,
  isMockPaymentHarnessEnabled,
} from '@/server/services/mock-payment-harness';
import { ConsoleEmailProvider } from '@/server/services/notification.service';
import {
  getMockCheckout,
  MockPaymentGateway,
  processMockCallback,
} from '@/server/services/payment-gateway.service';
import { PaymentService } from '@/server/services/payment.service';
import {
  assertPaymentProofRequestSize,
  MAX_PAYMENT_PROOF_REQUEST_BYTES,
} from '@/server/services/payment-submission.service';

const originalHarnessFlag = process.env.ENABLE_MOCK_PAYMENT_HARNESS;

afterEach(() => {
  if (originalHarnessFlag === undefined) delete process.env.ENABLE_MOCK_PAYMENT_HARNESS;
  else process.env.ENABLE_MOCK_PAYMENT_HARNESS = originalHarnessFlag;
  vi.restoreAllMocks();
});

describe('final payment-monitoring hardening', () => {
  it('requires the configured cron secret through either supported header', () => {
    expect(getCronAuthorizationFailure(new Request('http://localhost'), undefined)).toEqual({
      status: 503,
      message: 'CRON_SECRET is not configured.',
    });
    expect(
      getCronAuthorizationFailure(
        new Request('http://localhost', { headers: { 'x-cron-secret': 'wrong' } }),
        'expected'
      )
    ).toEqual({ status: 401, message: 'Invalid cron credentials.' });
    expect(
      getCronAuthorizationFailure(
        new Request('http://localhost', { headers: { authorization: 'Bearer expected' } }),
        'expected'
      )
    ).toBeNull();
    expect(
      getCronAuthorizationFailure(
        new Request('http://localhost', { headers: { 'x-cron-secret': 'expected' } }),
        'expected'
      )
    ).toBeNull();
  });

  it('keeps the mock payment harness disabled when the flag is absent', () => {
    delete process.env.ENABLE_MOCK_PAYMENT_HARNESS;

    expect(getServerEnv().ENABLE_MOCK_PAYMENT_HARNESS).toBe(false);
    expect(isMockPaymentHarnessEnabled()).toBe(false);
    expect(() => assertMockPaymentHarnessEnabled()).toThrowError(
      expect.objectContaining({ statusCode: 404 })
    );
  });

  it('requires explicit opt-in before enabling the mock payment harness', () => {
    process.env.ENABLE_MOCK_PAYMENT_HARNESS = 'true';
    expect(isMockPaymentHarnessEnabled()).toBe(true);
    expect(() => assertMockPaymentHarnessEnabled()).not.toThrow();
  });

  it('blocks every mock service entry point while the harness is disabled', async () => {
    delete process.env.ENABLE_MOCK_PAYMENT_HARNESS;
    const db = {} as DatabaseInstance;
    const gateway = new MockPaymentGateway(db);
    const checkoutInput = {
      studentId: '00000000-0000-4000-8000-000000000001',
      amountCentavos: 1_00,
      paymentChannel: 'GCash' as const,
      idempotencyKey: 'hardening-checkout-12345678',
      parentUserId: '00000000-0000-4000-8000-000000000002',
    };
    const callbackInput = {
      paymentReference: 'MOCK-hardening',
      eventId: 'hardening-event-12345678',
      idempotencyKey: 'hardening-callback-12345678',
      status: 'SUCCESS' as const,
    };

    await expect(gateway.createCheckout(checkoutInput)).rejects.toMatchObject({ statusCode: 404 });
    await expect(gateway.verifyPayment('MOCK-hardening')).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(getMockCheckout('MOCK-hardening', db)).rejects.toMatchObject({ statusCode: 404 });
    await expect(processMockCallback(callbackInput, db)).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      PaymentService.recordPayment(
        {
          studentId: checkoutInput.studentId,
          amountCentavos: checkoutInput.amountCentavos,
          paymentMethod: 'MOCK_ONLINE',
          idempotencyKey: 'hardening-payment-12345678',
          skipNotifications: true,
        },
        db
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects oversized proof requests before multipart parsing', () => {
    const request = new Request('http://localhost/api/portal/parent/payment-submissions', {
      headers: { 'content-length': String(MAX_PAYMENT_PROOF_REQUEST_BYTES + 1) },
    });
    expect(() => assertPaymentProofRequestSize(request)).toThrow('upload is too large');
  });

  it('logs only sanitized console-delivery metadata', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await new ConsoleEmailProvider().send({
      to: 'parent@example.com',
      subject: 'Payment received for Alex Student',
      text: 'PHP 1,000.00 was posted for Alex Student.',
    });

    const logged = info.mock.calls.flat().join(' ');
    expect(logged).not.toContain('parent@example.com');
    expect(logged).not.toContain('Alex Student');
    expect(logged).not.toContain('1,000.00');
    expect(logged).toContain('recipientHash');
    expect(logged).toContain('bodyLength');
  });
});
