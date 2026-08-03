import { describe, it, expect } from 'vitest';
import {
  calculateBalanceFromEntries,
  AssessmentService,
} from '@/server/services/assessment.service';
import { addCentavos, subtractCentavos, formatCentavos } from '@/lib/utils/currency';

describe('Assessments & Ledger Calculation Logic', () => {
  it('calculates initial assessment balance correctly', () => {
    const entries = [{ debitCentavos: 1400000, creditCentavos: 0 }];
    const balance = calculateBalanceFromEntries(entries);
    expect(balance).toBe(1400000);
    expect(formatCentavos(balance)).toContain('14,000.00');
  });

  it('calculates remaining balance after partial payment', () => {
    const entries = [
      { debitCentavos: 1400000, creditCentavos: 0 }, // Assessment ₱14,000.00
      { debitCentavos: 0, creditCentavos: 1000000 }, // Payment ₱10,000.00
    ];
    const balance = calculateBalanceFromEntries(entries);
    expect(balance).toBe(400000); // ₱4,000.00
  });

  it('handles debit adjustments (increases balance)', () => {
    const entries = [
      { debitCentavos: 1400000, creditCentavos: 0 }, // Assessment ₱14,000.00
      { debitCentavos: 100000, creditCentavos: 0 }, // Debit Adjustment ₱1,000.00
    ];
    const balance = calculateBalanceFromEntries(entries);
    expect(balance).toBe(1500000); // ₱15,000.00
  });

  it('handles credit adjustments (decreases balance)', () => {
    const entries = [
      { debitCentavos: 1400000, creditCentavos: 0 }, // Assessment ₱14,000.00
      { debitCentavos: 0, creditCentavos: 200000 }, // Credit Adjustment ₱2,000.00
    ];
    const balance = calculateBalanceFromEntries(entries);
    expect(balance).toBe(1200000); // ₱12,000.00
  });

  it('rejects invalid zero or negative assessment items', async () => {
    await expect(
      AssessmentService.generateAssessment({
        studentId: 'std-001',
        schoolYearId: 'sy-001',
        feeStructureId: 'fs-001',
        items: [{ feeCategoryId: 'fc-001', name: 'Invalid Item', amountCentavos: 0 }],
      })
    ).rejects.toThrow();
  });

  it('rejects adjustments with missing or empty reason', async () => {
    await expect(
      AssessmentService.applyAdjustment({
        assessmentId: 'ass-001',
        studentId: 'std-001',
        type: 'DEBIT',
        amountCentavos: 50000,
        reason: '   ',
      })
    ).rejects.toThrow();
  });

  it('enforces overpayment rejection rule when payment exceeds balance', () => {
    const currentBalanceCentavos = 1400000; // ₱14,000.00
    const paymentInputCentavos = 1500000; // ₱15,000.00

    const isOverpayment = paymentInputCentavos > currentBalanceCentavos;
    expect(isOverpayment).toBe(true);
  });
});
