import { describe, expect, it } from 'vitest';
import { calculateAssessmentDueDate, evaluateDeadline } from '@/lib/deadlines';

describe('Payment deadline rules', () => {
  it('uses Manila calendar dates across the UTC boundary', () => {
    expect(calculateAssessmentDueDate(new Date('2026-08-01T15:59:59.000Z'), 7)).toBe('2026-08-08');
    expect(calculateAssessmentDueDate(new Date('2026-08-01T16:00:00.000Z'), 7)).toBe('2026-08-09');
  });

  it('derives PAID independently from deadline state', () => {
    expect(
      evaluateDeadline({
        balanceCentavos: 0,
        dueDate: '2026-08-01',
        reminderLeadDays: 2,
        today: '2026-08-11',
      })
    ).toMatchObject({ paymentStatus: 'PAID', deadlineState: 'PAID' });
  });

  it.each([
    ['ON_TRACK', '2026-08-20'],
    ['DUE_SOON', '2026-08-13'],
    ['OVERDUE', '2026-08-10'],
  ] as const)('derives %s for a remaining balance', (deadlineState, dueDate) => {
    expect(
      evaluateDeadline({ balanceCentavos: 100, dueDate, reminderLeadDays: 2, today: '2026-08-11' })
    ).toMatchObject({ paymentStatus: 'WITH_REMAINING_BALANCE', deadlineState });
  });
});
