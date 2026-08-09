import { describe, expect, it } from 'vitest';
import {
  mockCallbackInputSchema,
  mockPaymentOutcomeSchema,
  portalCheckoutInputSchema,
} from '@/lib/portal';

describe('Persisted mock payment input contracts', () => {
  it('accepts a checkout request without a browser return URL', () => {
    const parsed = portalCheckoutInputSchema.parse({
      studentId: '00000000-0000-4000-8000-000000000001',
      amountCentavos: 1400000,
      paymentChannel: 'GCash',
      idempotencyKey: 'checkout-12345678',
    });

    expect(parsed.paymentChannel).toBe('GCash');
    expect(parsed).not.toHaveProperty('returnUrl');
  });

  it('accepts success, failure, cancellation, and delayed outcomes', () => {
    expect(mockPaymentOutcomeSchema.options).toEqual(['SUCCESS', 'FAILED', 'CANCELLED', 'PENDING']);
  });

  it('requires callback event and idempotency identifiers', () => {
    expect(() =>
      mockCallbackInputSchema.parse({
        paymentReference: 'MOCK-reference',
        status: 'SUCCESS',
      })
    ).toThrow();
  });

  it('does not trust browser-supplied amount or student fields in callbacks', () => {
    const parsed = mockCallbackInputSchema.parse({
      paymentReference: 'MOCK-reference',
      eventId: 'event-12345678',
      idempotencyKey: 'callback-12345678',
      status: 'SUCCESS',
      amountCentavos: 1,
      studentId: 'attacker-student',
      paymentMethod: 'BANK_DEPOSIT',
    });

    expect(parsed).not.toHaveProperty('amountCentavos');
    expect(parsed).not.toHaveProperty('studentId');
    expect(parsed).not.toHaveProperty('paymentMethod');
  });
});
