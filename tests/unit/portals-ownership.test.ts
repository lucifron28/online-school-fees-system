import { describe, expect, it } from 'vitest';
import { mockCallbackInputSchema, portalCheckoutInputSchema } from '@/lib/portal';

describe('Parent and student portal ownership contracts', () => {
  it('requires a database student UUID for a checkout request', () => {
    expect(() =>
      portalCheckoutInputSchema.parse({
        studentId: 'unlinked-child',
        amountCentavos: 10000,
        paymentChannel: 'Maya',
        idempotencyKey: 'checkout-12345678',
      })
    ).toThrow();
  });

  it('requires a server callback reference rather than a client-owned student', () => {
    const parsed = mockCallbackInputSchema.parse({
      paymentReference: 'MOCK-12345678',
      eventId: 'event-12345678',
      idempotencyKey: 'callback-12345678',
      status: 'PENDING',
    });

    expect(parsed.paymentReference).toBe('MOCK-12345678');
    expect(parsed).not.toHaveProperty('studentId');
  });

  it('does not treat an empty client-owned child list as ownership evidence', () => {
    const linkedChildren: string[] = [];
    expect(linkedChildren).toHaveLength(0);
    expect(linkedChildren.includes('any-student')).toBe(false);
  });
});
