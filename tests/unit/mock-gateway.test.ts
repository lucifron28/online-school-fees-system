import { describe, it, expect, beforeEach } from 'vitest';
import { MockPaymentGateway } from '@/server/services/payment-gateway.service';

describe('Simulated Online Payment Gateway & Idempotent Callbacks', () => {
  let gateway: MockPaymentGateway;

  beforeEach(() => {
    gateway = new MockPaymentGateway();
    MockPaymentGateway.clearStore();
  });

  it('creates mock online checkout session successfully', async () => {
    const checkout = await gateway.createCheckout({
      studentId: 'std-001',
      assessmentId: 'ass-001',
      amountCentavos: 1400000,
      paymentChannel: 'GCash',
      returnUrl: 'http://localhost:3000/parent/pay',
      parentUserId: 'parent-001',
    });

    expect(checkout.paymentReference).toContain('PAY-ONLINE-');
    expect(checkout.redirectUrl).toContain('/parent/pay/mock-checkout');
  });

  it('verifies online payment and prevents duplicate callback replays (IDEMPOTENCY)', async () => {
    const ref = 'PAY-ONLINE-123456';

    // First callback execution
    const firstResult = MockPaymentGateway.processCallback(ref, 'SUCCESS', 1400000, 'std-001');
    expect(firstResult.isAlreadyProcessed).toBe(false);

    // Verify payment status
    const verification1 = await gateway.verifyPayment(ref);
    expect(verification1.isAlreadyProcessed).toBe(true);

    // Duplicate callback replay attempt
    const secondResult = MockPaymentGateway.processCallback(ref, 'SUCCESS', 1400000, 'std-001');
    expect(secondResult.isAlreadyProcessed).toBe(true);
  });

  it('rejects invalid or unknown payment reference format', async () => {
    await expect(gateway.verifyPayment('INVALID-REF-999')).rejects.toThrow(/UNKNOWN_REFERENCE/);
  });

  it('rejects checkout creation with zero or negative amount', async () => {
    await expect(
      gateway.createCheckout({
        studentId: 'std-001',
        assessmentId: 'ass-001',
        amountCentavos: 0,
        paymentChannel: 'Maya',
        returnUrl: 'http://localhost:3000/parent/pay',
        parentUserId: 'parent-001',
      })
    ).rejects.toThrow();
  });
});
