import { describe, it, expect } from 'vitest';
import { allocatePaymentToItems, PaymentService } from '@/server/services/payment.service';
import { generateReceiptPdf } from '@/lib/pdf/receipt-generator';

describe('OTC Payments, Receipts & Reversals Logic', () => {
  it('allocates payment to oldest unpaid assessment items first', () => {
    const items = [
      { id: 'item-1', name: 'Tuition Fee', amountCentavos: 1200000, paidCentavos: 0 },
      { id: 'item-2', name: 'Miscellaneous Fee', amountCentavos: 200000, paidCentavos: 0 },
    ];

    // Pay ₱13,000.00 (1300000 centavos)
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

  it('records cash and bank deposit payments successfully', async () => {
    const res = await PaymentService.recordPayment({
      studentId: 'std-001',
      assessmentId: 'ass-001',
      amountCentavos: 1400000,
      paymentMethod: 'CASH',
      processedByUserId: 'usr-finance-demo',
      currentBalanceCentavos: 1400000,
      assessmentItems: [
        { id: 'item-1', name: 'Tuition Fee', amountCentavos: 1400000, paidCentavos: 0 },
      ],
    });

    expect(res.status).toBe('POSTED');
    expect(res.receiptNumber).toContain('OSFS-2026-');
    expect(res.remainingBalanceCentavos).toBe(0);
  });

  it('rejects zero or negative payment amounts', async () => {
    await expect(
      PaymentService.recordPayment({
        studentId: 'std-001',
        assessmentId: 'ass-001',
        amountCentavos: 0,
        paymentMethod: 'CASH',
        processedByUserId: 'usr-finance-demo',
        currentBalanceCentavos: 1400000,
        assessmentItems: [],
      })
    ).rejects.toThrow();
  });

  it('rejects excess overpayment exceeding balance', async () => {
    await expect(
      PaymentService.recordPayment({
        studentId: 'std-001',
        assessmentId: 'ass-001',
        amountCentavos: 1500000, // ₱15,000.00
        paymentMethod: 'CASH',
        processedByUserId: 'usr-finance-demo',
        currentBalanceCentavos: 1400000, // ₱14,000.00
        assessmentItems: [],
      })
    ).rejects.toThrow(/Overpayment rejected/);
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

  it('reverses payment and prevents double reversals', async () => {
    const reversal = await PaymentService.reversePayment({
      paymentId: 'pay-001',
      receiptId: 'rcp-001',
      reason: 'Incorrect amount tendered by cashier',
      reversedByUserId: 'usr-admin-demo',
    });

    expect(reversal.paymentStatus).toBe('REVERSED');
    expect(reversal.receiptStatus).toBe('VOIDED');

    await expect(
      PaymentService.reversePayment({
        paymentId: 'pay-001',
        receiptId: 'rcp-001',
        reason: 'Attempt double reversal',
        reversedByUserId: 'usr-admin-demo',
        isAlreadyReversed: true,
      })
    ).rejects.toThrow(/Payment has already been reversed/);
  });
});
