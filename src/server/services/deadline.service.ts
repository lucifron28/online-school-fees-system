import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { evaluateDeadline, type DeadlineState, type PaymentBalanceStatus } from '@/lib/deadlines';
import { getManilaDateString } from '@/lib/reports';
import { getOrCreateSchoolSettings } from './administration.service';
import { calculateBalanceFromEntries } from './assessment.service';

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
  input: { now?: Date; limit?: number } = {},
  db: DatabaseInstance = getDb()
): Promise<AssessmentDeadlineMonitorItem[]> {
  const rows = await db
    .select({
      assessmentId: schema.studentAssessments.id,
      studentId: schema.studentAssessments.studentId,
      studentNumber: schema.students.studentNumber,
      studentFirstName: schema.students.firstName,
      studentLastName: schema.students.lastName,
      feeStructureName: schema.feeStructures.name,
      dueDate: schema.studentAssessments.dueDate,
      createdAt: schema.studentAssessments.createdAt,
    })
    .from(schema.studentAssessments)
    .innerJoin(schema.students, eq(schema.students.id, schema.studentAssessments.studentId))
    .innerJoin(
      schema.feeStructures,
      eq(schema.feeStructures.id, schema.studentAssessments.feeStructureId)
    )
    .where(
      and(
        eq(schema.studentAssessments.status, 'POSTED'),
        isNotNull(schema.studentAssessments.dueDate)
      )
    )
    .orderBy(asc(schema.studentAssessments.dueDate), asc(schema.studentAssessments.createdAt));

  if (rows.length === 0) return [];
  const assessmentIds = rows.map((row) => row.assessmentId);
  const [ledgerEntries, settings] = await Promise.all([
    db
      .select({
        assessmentId: schema.ledgerEntries.assessmentId,
        debitCentavos: schema.ledgerEntries.debitCentavos,
        creditCentavos: schema.ledgerEntries.creditCentavos,
      })
      .from(schema.ledgerEntries)
      .where(inArray(schema.ledgerEntries.assessmentId, assessmentIds)),
    getOrCreateSchoolSettings(db),
  ]);
  const entriesByAssessment = new Map<
    string,
    Array<{ debitCentavos: number; creditCentavos: number }>
  >();
  for (const entry of ledgerEntries) {
    if (!entry.assessmentId) continue;
    const current = entriesByAssessment.get(entry.assessmentId) ?? [];
    current.push(entry);
    entriesByAssessment.set(entry.assessmentId, current);
  }

  const today = getManilaDateString(input.now);
  const evaluated = rows.map((row) => {
    const balanceCentavos = calculateBalanceFromEntries(
      entriesByAssessment.get(row.assessmentId) ?? []
    );
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

  const limit = Math.min(Math.max(input.limit ?? evaluated.length, 1), 1000);
  return evaluated
    .filter((item) => item.deadlineState === 'DUE_SOON' || item.deadlineState === 'OVERDUE')
    .slice(0, limit);
}

export async function getDeadlineSummary(
  input: { now?: Date; limit?: number } = {},
  db: DatabaseInstance = getDb()
): Promise<DeadlineSummary> {
  const items = await listAssessmentDeadlineMonitor({ ...input, limit: 1000 }, db);
  const dueSoon = items.filter((item) => item.deadlineState === 'DUE_SOON');
  const overdue = items.filter((item) => item.deadlineState === 'OVERDUE');
  return {
    dueSoonCount: dueSoon.length,
    overdueCount: overdue.length,
    dueSoon,
    overdue,
  };
}
