import { z } from 'zod/v3';

export const REPORT_TIME_ZONE = 'Asia/Manila';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const reportDateSchema = z
  .string()
  .regex(datePattern, 'Dates must use YYYY-MM-DD format.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'The selected date is invalid.');

export const reportDateRangeInputSchema = z
  .object({
    from: reportDateSchema.optional(),
    to: reportDateSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['from'],
        message: 'The start date must be on or before the end date.',
      });
    }
  });

export const reportKindSchema = z.enum([
  'collections',
  'outstanding',
  'payments',
  'reversals',
  'payment-method',
  'grade-level',
]);

export type ReportDateRangeInput = z.infer<typeof reportDateRangeInputSchema>;
export type ReportKind = z.infer<typeof reportKindSchema>;

export function parseReportDateRangeSearchParams(params: URLSearchParams): ReportDateRangeInput {
  return reportDateRangeInputSchema.parse({
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
  });
}

export interface ReportDateRange {
  from: string;
  to: string;
  start: Date;
  end: Date;
}

export interface ReconciliationResult {
  status: 'RECONCILED' | 'REVERSED' | 'REVIEW';
  note: string;
}

export interface CollectionReportItem {
  id: string;
  receiptNumber: string | null;
  studentId: string;
  studentNumber: string;
  studentName: string;
  gradeLevelName: string | null;
  sectionName: string | null;
  amountCentavos: number;
  paymentMethod: string;
  referenceNumber: string | null;
  status: string;
  createdAt: Date;
  reconciliationStatus: ReconciliationResult['status'];
  note: string;
}

export interface CollectionReportTotals {
  grossCollectionsCentavos: number;
  netCollectionsCentavos: number;
  reversedCentavos: number;
  postedTransactionCount: number;
  reversedTransactionCount: number;
}

export interface CollectionBreakdown {
  key: string;
  label: string;
  amountCentavos: number;
  transactionCount: number;
}

export interface CollectionReport {
  dateRange: Pick<ReportDateRange, 'from' | 'to'>;
  items: CollectionReportItem[];
  totals: CollectionReportTotals;
  byPaymentMethod: CollectionBreakdown[];
  byGradeLevel: CollectionBreakdown[];
}

export interface OutstandingBalanceItem {
  studentId: string;
  studentNumber: string;
  studentName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'WITHDRAWN' | 'GRADUATED';
  gradeLevelName: string | null;
  sectionName: string | null;
  outstandingBalanceCentavos: number;
  postedAssessmentCount: number;
}

export interface ReversalReportItem {
  id: string;
  paymentId: string;
  receiptNumber: string | null;
  studentNumber: string;
  studentName: string;
  gradeLevelName: string | null;
  amountCentavos: number;
  paymentMethod: string;
  reason: string;
  reversedByName: string | null;
  reversedAt: Date;
}

export interface StatementEntry {
  id: string;
  createdAt: Date;
  entryType: string;
  description: string;
  debitCentavos: number;
  creditCentavos: number;
  balanceCentavos: number;
}

export interface StudentStatement {
  student: {
    id: string;
    studentNumber: string;
    name: string;
    email: string;
    gradeLevelName: string | null;
    sectionName: string | null;
  };
  dateRange: Pick<ReportDateRange, 'from' | 'to'> | null;
  openingBalanceCentavos: number | null;
  entries: StatementEntry[];
  payments: CollectionReportItem[];
  closingBalanceCentavos: number;
  institution: {
    name: string;
    address: string;
    email: string;
    phone: string;
  };
}

export interface DashboardTransaction extends CollectionReportItem {}

export interface DashboardMetrics {
  activeStudents: number;
  collectionsTodayCentavos: number;
  collectionsMonthCentavos: number;
  outstandingBalanceCentavos: number;
  postedTransactionsCount: number;
  recentTransactions: DashboardTransaction[];
  collectionTrend: Array<{
    period: string;
    label: string;
    amountCentavos: number;
  }>;
  paymentMethodBreakdown: CollectionBreakdown[];
}

const MANILA_OFFSET_MINUTES = 8 * 60;

function dateParts(value: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = (type: 'year' | 'month' | 'day') =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function getManilaDateString(value: Date = new Date()): string {
  const { year, month, day } = dateParts(value);
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}

export function addManilaDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;
}

export function addManilaMonths(value: string, months: number): string {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-01`;
}

export function parseManilaDateStart(value: string): Date {
  reportDateSchema.parse(value);
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - MANILA_OFFSET_MINUTES * 60 * 1000);
}

export function resolveReportDateRange(
  input: ReportDateRangeInput = {},
  now: Date = new Date()
): ReportDateRange {
  const values = reportDateRangeInputSchema.parse(input);
  const today = getManilaDateString(now);
  const monthStart = `${today.slice(0, 8)}01`;
  const from = values.from ?? monthStart;
  const to = values.to ?? today;
  return {
    from,
    to,
    start: parseManilaDateStart(from),
    end: parseManilaDateStart(addManilaDays(to, 1)),
  };
}

export function formatReportDate(value: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: REPORT_TIME_ZONE,
  }).format(value);
}
