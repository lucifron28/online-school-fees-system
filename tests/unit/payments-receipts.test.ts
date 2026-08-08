import { describe, it, expect } from 'vitest';
import { allocatePaymentToItems, PaymentService } from '@/server/services/payment.service';
import { paymentPostInputSchema, reversalPostInputSchema } from '@/lib/payments';
import { generateReceiptPdf } from '@/lib/pdf/receipt-generator';

const studentId = '00000000-0000-4000-8000-000000000001';
const paymentId = '00000000-0000-4000-8000-000000000002';

describe('OTC Payments, Receipts & Reversals Logic', () => {
  it('allocates payment to oldest unpaid assessment items first', () => {
    const items = [
      { id: 'item-1', name: 'Tuition Fee', amountCentavos: 1200000, paidCentavos: 0 },
      { id: 'item-2', name: 'Miscellaneous Fee', amountCentavos: 200000, paidCentavos: 0 },
    ];

    const allocations = allocatePaymentToItems(1300000, items);

    expect(allocations).toHaveLength(2);
    expect(allocations[0]).toEqual({
      assessmentItemId: 'item-1',
      name: 'Tuition Fee',
      amountCentavos: 1200000,
    });
    expect(allocations[1]).toEqual({
      assessmentItemId: 'item-2',
      name: 'Miscellaneous Fee',
      amountCentavos: 100000,
    });
  });

  it('validates an OTC payment request without accepting client balances', () => {
    const input = paymentPostInputSchema.parse({
      studentId,
      amountCentavos: 1400000,
      paymentMethod: 'CASH',
      idempotencyKey: 'phase-six-payment-001',
    });

    expect(input.studentId).toBe(studentId);
    expect(input.amountCentavos).toBe(1400000);
  });

  it('rejects zero or negative payment amounts before database access', async () => {
    await expect(
      PaymentService.recordPayment({
        studentId,
        amountCentavos: 0,
        paymentMethod: 'CASH',
        idempotencyKey: 'phase-six-payment-002',
        processedByUserId: 'finance-demo',
      })
    ).rejects.toThrow();
  });

  it('requires an idempotency key for every payment request', () => {
    expect(() =>
      paymentPostInputSchema.parse({
        studentId,
        amountCentavos: 1500000,
        paymentMethod: 'CASH',
      })
    ).toThrow();
  });

  it('generates a valid binary PDF receipt document using pdf-lib', async () => {
    const pdfBytes = await generateReceiptPdf({
      receiptNumber: 'OSFS-2026-000123',
      verificationIdentifier: 'VER-ABC123XYZ',
      paymentDate: 'May 30, 2024 10:30 AM',
      paymentMethod: 'CASH',
      studentNumber: 'S2026-0001',
      studentName: 'Juan Dela Cruz Jr.',
      gradeAndSection: 'Grade 10 - A',
      amountReceivedCentavos: 1400000,
      remainingBalanceCentavos: 0,
      processedByName: 'Finance Staff',
      allocations: [{ name: 'Tuition Fee', amountCentavos: 1400000 }],
      institution: {
        name: 'Online School Fees Monitoring System',
        address: '123 Education Way, Manila',
        email: 'info@schoolfees.example.com',
        phone: '+63 2 8123-4567',
      },
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);
  });

  it('requires a valid payment identifier and reason for reversal', () => {
    expect(() => reversalPostInputSchema.parse({ paymentId, reason: '   ' })).toThrow();
    expect(() =>
      reversalPostInputSchema.parse({ paymentId: 'pay-001', reason: 'Valid reason' })
    ).toThrow();
  });
});
