import { addManilaDays, getManilaDateString, reportDateSchema } from '@/lib/reports';

export const DEADLINE_STATES = ['ON_TRACK', 'DUE_SOON', 'OVERDUE', 'PAID'] as const;
export type DeadlineState = (typeof DEADLINE_STATES)[number];
export type PaymentBalanceStatus = 'PAID' | 'WITH_REMAINING_BALANCE';

export interface DeadlineEvaluation {
  deadlineState: DeadlineState;
  paymentStatus: PaymentBalanceStatus;
  daysFromDueDate: number | null;
}

export function calculateDaysFromDueDate(dueDate: string, today = getManilaDateString()): number {
  reportDateSchema.parse(dueDate);
  reportDateSchema.parse(today);
  const [dueYear, dueMonth, dueDay] = dueDate.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const due = Date.UTC(dueYear, dueMonth - 1, dueDay);
  const current = Date.UTC(todayYear, todayMonth - 1, todayDay);
  return Math.round((due - current) / 86_400_000);
}

export function calculateAssessmentDueDate(
  postedAt: Date = new Date(),
  paymentTermDays = 7
): string {
  if (!Number.isInteger(paymentTermDays) || paymentTermDays < 1 || paymentTermDays > 365) {
    throw new Error('Payment term days must be between 1 and 365.');
  }
  return addManilaDays(getManilaDateString(postedAt), paymentTermDays);
}

export function evaluateDeadline({
  balanceCentavos,
  dueDate,
  reminderLeadDays,
  today = getManilaDateString(),
}: {
  balanceCentavos: number;
  dueDate: string | null;
  reminderLeadDays: number;
  today?: string;
}): DeadlineEvaluation {
  const paymentStatus: PaymentBalanceStatus =
    balanceCentavos === 0 ? 'PAID' : 'WITH_REMAINING_BALANCE';
  if (paymentStatus === 'PAID') {
    return { deadlineState: 'PAID', paymentStatus, daysFromDueDate: null };
  }
  if (!dueDate) {
    return { deadlineState: 'ON_TRACK', paymentStatus, daysFromDueDate: null };
  }

  const daysFromDueDate = calculateDaysFromDueDate(dueDate, today);
  if (daysFromDueDate < 0) {
    return { deadlineState: 'OVERDUE', paymentStatus, daysFromDueDate };
  }
  if (daysFromDueDate <= reminderLeadDays) {
    return { deadlineState: 'DUE_SOON', paymentStatus, daysFromDueDate };
  }
  return { deadlineState: 'ON_TRACK', paymentStatus, daysFromDueDate };
}

export function deadlineStateLabel(state: DeadlineState): string {
  return state === 'PAID' ? 'FULLY PAID' : state.replaceAll('_', ' ');
}

export function paymentStatusLabel(status: PaymentBalanceStatus): string {
  return status === 'PAID' ? 'FULLY PAID' : 'WITH REMAINING BALANCE';
}

export function paymentStatusClass(status: PaymentBalanceStatus): string {
  return status === 'PAID'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-blue-200 bg-blue-50 text-blue-700';
}
