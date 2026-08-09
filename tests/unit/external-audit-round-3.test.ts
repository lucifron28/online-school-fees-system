import { describe, expect, it } from 'vitest';
import {
  assertStudentAssessmentReconciliation,
  reconcileStudentAssessmentBalances,
} from '@/server/services/assessment.service';
import { allocatePaymentToObligations } from '@/server/services/payment.service';
import { receiptSnapshotSchema, parseReceiptSnapshot } from '@/lib/receipt-snapshot';

function obligation(
  assessmentId: string,
  itemId: string,
  amountCentavos: number,
  assessmentBalanceCentavos: number,
  createdAt = new Date('2026-01-01T00:00:00Z')
) {
  return {
    id: itemId,
    assessmentId,
    targetType: 'ASSESSMENT_ITEM' as const,
    assessmentItemId: itemId,
    adjustmentId: null,
    name: itemId,
    amountCentavos,
    paidCentavos: 0,
    assessmentBalanceCentavos,
    createdAt,
    assessmentCreatedAt: createdAt,
  };
}

describe('external audit round 3 pure financial invariants', () => {
  it('caps allocation by each assessment net capacity, not by student-wide debt', () => {
    const allocations = allocatePaymentToObligations(100_00, [
      obligation('assessment-a', 'item-a', 100_00, 20_00),
      obligation('assessment-b', 'item-b', 100_00, 100_00, new Date('2026-01-02T00:00:00Z')),
    ]);

    expect(
      allocations.map(({ assessmentId, amountCentavos }) => [assessmentId, amountCentavos])
    ).toEqual([
      ['assessment-a', 20_00],
      ['assessment-b', 80_00],
    ]);
  });

  it('skips an assessment whose credit adjustment exactly consumes its charge', () => {
    const allocations = allocatePaymentToObligations(50_00, [
      obligation('assessment-a', 'item-a', 100_00, 0),
      obligation('assessment-b', 'item-b', 100_00, 100_00, new Date('2026-01-02T00:00:00Z')),
    ]);

    expect(allocations).toHaveLength(1);
    expect(allocations[0]).toMatchObject({ assessmentId: 'assessment-b', amountCentavos: 50_00 });
  });

  it('reconciles assessment-attributed balances to the student ledger balance', () => {
    const entries = [
      { assessmentId: 'assessment-a', debitCentavos: 100_00, creditCentavos: 20_00 },
      { assessmentId: 'assessment-b', debitCentavos: 75_00, creditCentavos: 25_00 },
    ];
    const result = reconcileStudentAssessmentBalances(entries);

    expect(result.studentBalanceCentavos).toBe(130_00);
    expect(result.attributedBalanceCentavos).toBe(130_00);
    expect(result.assessmentBalances).toEqual(
      new Map([
        ['assessment-a', 80_00],
        ['assessment-b', 50_00],
      ])
    );
    expect(result.isReconciled).toBe(true);
    expect(() => assertStudentAssessmentReconciliation(result)).not.toThrow();
  });

  it('does not treat unattributed ledger residue as an assessment balance', () => {
    const result = reconcileStudentAssessmentBalances([
      { assessmentId: 'assessment-a', debitCentavos: 100_00, creditCentavos: 0 },
      { assessmentId: null, debitCentavos: 0, creditCentavos: 10_00 },
    ]);

    expect(result.studentBalanceCentavos).toBe(90_00);
    expect(result.attributedBalanceCentavos).toBe(100_00);
    expect(result.isReconciled).toBe(false);
  });

  it('rejects a negative assessment balance even when the student-wide balance is positive', () => {
    const result = reconcileStudentAssessmentBalances([
      { assessmentId: 'assessment-a', debitCentavos: 10_00, creditCentavos: 20_00 },
      { assessmentId: 'assessment-b', debitCentavos: 100_00, creditCentavos: 0 },
    ]);

    expect(result.studentBalanceCentavos).toBe(90_00);
    expect(result.isReconciled).toBe(true);
    expect(() => assertStudentAssessmentReconciliation(result)).toThrow(
      /non-negative assessment balances/
    );
  });

  it('validates snapshot allocation totals and safely treats legacy data as absent', () => {
    const snapshot = receiptSnapshotSchema.parse({
      version: 1,
      issuedAt: '2026-08-01T01:00:00.000Z',
      receiptNumber: 'OSFS-2026-000001',
      verificationIdentifier: 'VER-1',
      institution: {
        name: 'School',
        address: 'Address',
        email: 'school@example.com',
        phone: '+63',
        timezone: 'Asia/Manila',
      },
      student: { studentNumber: 'S-1', name: 'Student One', gradeAndSection: 'Grade 7 - A' },
      payment: {
        amountCentavos: 100_00,
        paymentMethod: 'CASH',
        referenceNumber: null,
        balanceAfterPaymentCentavos: 200_00,
      },
      processor: { name: 'Finance Staff' },
      allocations: [{ targetType: 'ASSESSMENT_ITEM', name: 'Tuition', amountCentavos: 100_00 }],
    });

    expect(parseReceiptSnapshot(snapshot)?.payment.balanceAfterPaymentCentavos).toBe(200_00);
    expect(parseReceiptSnapshot({ version: 1 })).toBeNull();
  });
});
