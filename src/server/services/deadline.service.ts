import { and, asc, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { getDb, type DatabaseClient, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { evaluateDeadline, type DeadlineState, type PaymentBalanceStatus } from '@/lib/deadlines';
import { addManilaDays, getManilaDateString } from '@/lib/reports';
import { getOrCreateSchoolSettings } from './administration.service';

export interface AssessmentDeadlineMonitorItem {
  assessmentId: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  feeStructureName: string;
  dueDate: string;
  balanceCentavos: number;
  paymentStatus: PaymentBalanceStatus;
  deadlineState: DeadlineState;
  daysRemaining: number;
  daysOverdue: number;
}

export interface DeadlineSummary {
  dueSoonCount: number;
  overdueCount: number;
  dueSoon: AssessmentDeadlineMonitorItem[];
  overdue: AssessmentDeadlineMonitorItem[];
}

export async function listAssessmentDeadlineMonitor(
  input: { now?: Date; limit?: number; offset?: number } = {},
  db: DatabaseClient = getDb()
): Promise<AssessmentDeadlineMonitorItem[]> {
  const settings = await getOrCreateSchoolSettings(db);
  const today = getManilaDateString(input.now);
  const maxDueDate = addManilaDays(today, settings.reminderLeadDays);

  const ledgerTotals = db
    .select({
      assessmentId: schema.ledgerEntries.assessmentId,
      debitCentavos: sql<number>`coalesce(sum(${schema.ledgerEntries.debitCentavos}), 0)`.as(
        'debit_centavos'
      ),
      creditCentavos: sql<number>`coalesce(sum(${schema.ledgerEntries.creditCentavos}), 0)`.as(
        'credit_centavos'
      ),
    })
    .from(schema.ledgerEntries)
    .groupBy(schema.ledgerEntries.assessmentId)
    .as('deadline_ledger_totals');

  const balanceExpr = sql<number>`coalesce(${ledgerTotals.debitCentavos}, 0) - coalesce(${ledgerTotals.creditCentavos}, 0)`;

  let query = db
    .select({
      assessmentId: schema.studentAssessments.id,
      studentId: schema.studentAssessments.studentId,
      studentNumber: schema.students.studentNumber,
      studentFirstName: schema.students.firstName,
      studentLastName: schema.students.lastName,
      feeStructureName: schema.feeStructures.name,
      dueDate: schema.studentAssessments.dueDate,
      createdAt: schema.studentAssessments.createdAt,
      balanceCentavos: sql<number>`coalesce(${balanceExpr}, ${schema.studentAssessments.totalAmountCentavos})`,
    })
    .from(schema.studentAssessments)
    .innerJoin(schema.students, eq(schema.students.id, schema.studentAssessments.studentId))
    .innerJoin(
      schema.feeStructures,
      eq(schema.feeStructures.id, schema.studentAssessments.feeStructureId)
    )
    .leftJoin(ledgerTotals, eq(ledgerTotals.assessmentId, schema.studentAssessments.id))
    .where(
      and(
        eq(schema.studentAssessments.status, 'POSTED'),
        isNotNull(schema.studentAssessments.dueDate),
        lte(schema.studentAssessments.dueDate, maxDueDate),
        sql`coalesce(${balanceExpr}, ${schema.studentAssessments.totalAmountCentavos}) > 0`
      )
    )
    .orderBy(asc(schema.studentAssessments.dueDate), asc(schema.studentAssessments.id));

  if (input.limit !== undefined) {
    const limit = Math.max(Math.trunc(input.limit), 0);
    query = query.limit(limit) as typeof query;
  }
  if (input.offset !== undefined) {
    const offset = Math.max(Math.trunc(input.offset), 0);
    query = query.offset(offset) as typeof query;
  }

  const rows = await query;
  if (rows.length === 0) return [];

  const evaluated = rows.map((row) => {
    const balanceCentavos = Number(row.balanceCentavos);
    const dueDate = row.dueDate!;
    const deadline = evaluateDeadline({
      balanceCentavos,
      dueDate,
      reminderLeadDays: settings.reminderLeadDays,
      today,
    });
    return {
      assessmentId: row.assessmentId,
      studentId: row.studentId,
      studentNumber: row.studentNumber,
      studentName: `${row.studentFirstName} ${row.studentLastName}`,
      feeStructureName: row.feeStructureName,
      dueDate,
      balanceCentavos,
      paymentStatus: deadline.paymentStatus,
      deadlineState: deadline.deadlineState,
      daysRemaining: Math.max(deadline.daysFromDueDate ?? 0, 0),
      daysOverdue: Math.max(-(deadline.daysFromDueDate ?? 0), 0),
    } satisfies AssessmentDeadlineMonitorItem;
  });

  return evaluated.filter(
    (item) => item.deadlineState === 'DUE_SOON' || item.deadlineState === 'OVERDUE'
  );
}

export async function getDeadlineSummary(
  input: { now?: Date; limit?: number } = {},
  db: DatabaseInstance = getDb()
): Promise<DeadlineSummary> {
  const items = await listAssessmentDeadlineMonitor({ ...input, limit: undefined }, db);
  const dueSoon = items.filter((item) => item.deadlineState === 'DUE_SOON');
  const overdue = items.filter((item) => item.deadlineState === 'OVERDUE');
  const displayLimit = input.limit === undefined ? undefined : Math.max(Math.trunc(input.limit), 0);
  return {
    dueSoonCount: dueSoon.length,
    overdueCount: overdue.length,
    dueSoon: displayLimit === undefined ? dueSoon : dueSoon.slice(0, displayLimit),
    overdue: displayLimit === undefined ? overdue : overdue.slice(0, displayLimit),
  };
}
