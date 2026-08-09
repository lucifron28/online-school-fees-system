import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { getServerEnv } from '@/lib/env';
import { calculateBalanceFromEntries } from './assessment.service';
import { calculateNetPaidFromEntries } from './ledger.service';
import { getReceiptPdfData } from './payment.service';
import { ForbiddenError, NotFoundError, ValidationError } from '@/server/errors/index';
import { getStudentAssessments, getStudentLedger } from './assessment.service';

export type PortalRole = 'PARENT' | 'STUDENT';

export interface LinkedChildSummary {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  gradeLevelName: string | null;
  sectionName: string | null;
  schoolYearName: string | null;
  outstandingBalanceCentavos: number;
  totalPaidCentavos: number;
}

export interface PortalPaymentSummary {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  amountCentavos: number;
  paymentMethod: string;
  referenceNumber: string | null;
  status: string;
  createdAt: Date;
  receiptId: string | null;
  receiptNumber: string | null;
  receiptStatus: string | null;
  allocations: Array<{
    targetType: 'ASSESSMENT_ITEM' | 'DEBIT_ADJUSTMENT';
    name: string;
    amountCentavos: number;
  }>;
}

type PortalAssessments = Awaited<ReturnType<typeof getStudentAssessments>>;
type PortalLedger = Awaited<ReturnType<typeof getStudentLedger>>;

export interface PortalStudentAccount {
  student: LinkedChildSummary;
  assessments: PortalAssessments;
  ledger: PortalLedger;
  payments: PortalPaymentSummary[];
}

async function selectStudentProfile(studentId: string, db: DatabaseInstance) {
  const rows = await db
    .select({
      studentId: schema.students.id,
      studentNumber: schema.students.studentNumber,
      firstName: schema.students.firstName,
      lastName: schema.students.lastName,
      email: schema.students.email,
      gradeLevelName: schema.gradeLevels.name,
      sectionName: schema.sections.name,
      schoolYearName: schema.schoolYears.name,
      status: schema.students.status,
    })
    .from(schema.students)
    .leftJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.students.gradeLevelId))
    .leftJoin(schema.sections, eq(schema.sections.id, schema.students.sectionId))
    .leftJoin(schema.schoolYears, eq(schema.schoolYears.id, schema.students.schoolYearId))
    .where(eq(schema.students.id, studentId))
    .limit(1);
  if (!rows[0]) throw new NotFoundError('The student record does not exist.');
  return rows[0];
}

async function selectLedgerTotals(studentIds: string[], db: DatabaseInstance) {
  if (studentIds.length === 0) return new Map<string, { balance: number; paid: number }>();

  const entries = await db
    .select({
      studentId: schema.ledgerEntries.studentId,
      debitCentavos: schema.ledgerEntries.debitCentavos,
      creditCentavos: schema.ledgerEntries.creditCentavos,
      entryType: schema.ledgerEntries.entryType,
    })
    .from(schema.ledgerEntries)
    .where(inArray(schema.ledgerEntries.studentId, studentIds));

  const entriesByStudent = new Map<
    string,
    Array<{
      entryType: string;
      debitCentavos: number;
      creditCentavos: number;
    }>
  >();
  for (const entry of entries) {
    const studentEntries = entriesByStudent.get(entry.studentId) ?? [];
    studentEntries.push(entry);
    entriesByStudent.set(entry.studentId, studentEntries);
  }

  const totals = new Map<string, { balance: number; paid: number }>();
  for (const studentId of studentIds) {
    const studentEntries = entriesByStudent.get(studentId) ?? [];
    totals.set(studentId, {
      balance: calculateBalanceFromEntries(studentEntries),
      paid: calculateNetPaidFromEntries(studentEntries),
    });
  }
  return totals;
}

async function selectParentChildIds(parentUserId: string, db: DatabaseInstance) {
  const rows = await db
    .select({ studentId: schema.students.id })
    .from(schema.guardians)
    .innerJoin(schema.guardianStudents, eq(schema.guardianStudents.guardianId, schema.guardians.id))
    .innerJoin(schema.students, eq(schema.students.id, schema.guardianStudents.studentId))
    .where(eq(schema.guardians.userId, parentUserId));
  return rows.map((row) => row.studentId);
}

async function assertStudentPortalEnabled() {
  if (getServerEnv().ENABLE_STUDENT_PORTAL === false) {
    throw new ForbiddenError('The student portal is disabled by institution settings.');
  }
}

async function assertStudentOwnership(
  userId: string,
  role: PortalRole,
  studentId: string,
  db: DatabaseInstance
) {
  if (!userId) throw new ForbiddenError('Portal authentication is required.');
  if (role === 'STUDENT') {
    await assertStudentPortalEnabled();
    const rows = await db
      .select({ id: schema.students.id })
      .from(schema.students)
      .where(and(eq(schema.students.id, studentId), eq(schema.students.userId, userId)))
      .limit(1);
    if (!rows[0]) throw new ForbiddenError('Students may only access their own records.');
    return;
  }

  const rows = await db
    .select({ id: schema.guardianStudents.id })
    .from(schema.guardians)
    .innerJoin(schema.guardianStudents, eq(schema.guardianStudents.guardianId, schema.guardians.id))
    .where(
      and(eq(schema.guardians.userId, userId), eq(schema.guardianStudents.studentId, studentId))
    )
    .limit(1);
  if (!rows[0]) throw new ForbiddenError('Parents may only access linked children.');
}

function toChildSummary(
  student: Awaited<ReturnType<typeof selectStudentProfile>>,
  totals: { balance: number; paid: number } | undefined
): LinkedChildSummary {
  return {
    studentId: student.studentId,
    studentNumber: student.studentNumber,
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    gradeLevelName: student.gradeLevelName,
    sectionName: student.sectionName,
    schoolYearName: student.schoolYearName,
    outstandingBalanceCentavos: totals?.balance ?? 0,
    totalPaidCentavos: totals?.paid ?? 0,
  };
}

export async function listOwnedPayments(
  userId: string,
  role: PortalRole,
  db: DatabaseInstance = getDb()
): Promise<PortalPaymentSummary[]> {
  if (role === 'STUDENT') await assertStudentPortalEnabled();

  const baseSelection = {
    id: schema.payments.id,
    studentId: schema.payments.studentId,
    studentNumber: schema.students.studentNumber,
    studentFirstName: schema.students.firstName,
    studentLastName: schema.students.lastName,
    amountCentavos: schema.payments.amountCentavos,
    paymentMethod: schema.payments.paymentMethod,
    referenceNumber: schema.payments.referenceNumber,
    status: schema.payments.status,
    createdAt: schema.payments.createdAt,
    receiptId: schema.receipts.id,
    receiptNumber: schema.receipts.receiptNumber,
    receiptStatus: schema.receipts.status,
  };

  const rows =
    role === 'PARENT'
      ? await db
          .select(baseSelection)
          .from(schema.payments)
          .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
          .innerJoin(
            schema.guardianStudents,
            eq(schema.guardianStudents.studentId, schema.students.id)
          )
          .innerJoin(schema.guardians, eq(schema.guardians.id, schema.guardianStudents.guardianId))
          .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
          .where(eq(schema.guardians.userId, userId))
          .orderBy(desc(schema.payments.createdAt))
      : await db
          .select(baseSelection)
          .from(schema.payments)
          .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
          .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
          .where(eq(schema.students.userId, userId))
          .orderBy(desc(schema.payments.createdAt));

  const paymentIds = rows.map((row) => row.id);
  const allocationRows =
    paymentIds.length === 0
      ? []
      : await db
          .select({
            paymentId: schema.paymentAllocations.paymentId,
            adjustmentId: schema.paymentAllocations.adjustmentId,
            itemName: schema.assessmentItems.name,
            adjustmentReason: schema.adjustments.reason,
            amountCentavos: schema.paymentAllocations.amountCentavos,
          })
          .from(schema.paymentAllocations)
          .leftJoin(
            schema.assessmentItems,
            eq(schema.assessmentItems.id, schema.paymentAllocations.assessmentItemId)
          )
          .leftJoin(
            schema.adjustments,
            eq(schema.adjustments.id, schema.paymentAllocations.adjustmentId)
          )
          .where(inArray(schema.paymentAllocations.paymentId, paymentIds))
          .orderBy(asc(schema.paymentAllocations.createdAt));
  const allocationsByPayment = new Map<string, PortalPaymentSummary['allocations']>();
  for (const allocation of allocationRows) {
    const current = allocationsByPayment.get(allocation.paymentId) ?? [];
    current.push({
      targetType: allocation.adjustmentId ? 'DEBIT_ADJUSTMENT' : 'ASSESSMENT_ITEM',
      name: allocation.itemName ?? allocation.adjustmentReason ?? 'Debit adjustment',
      amountCentavos: allocation.amountCentavos,
    });
    allocationsByPayment.set(allocation.paymentId, current);
  }

  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    studentNumber: row.studentNumber,
    studentName: `${row.studentFirstName} ${row.studentLastName}`,
    amountCentavos: row.amountCentavos,
    paymentMethod: row.paymentMethod,
    referenceNumber: row.referenceNumber,
    status: row.status,
    createdAt: row.createdAt,
    receiptId: row.receiptId,
    receiptNumber: row.receiptNumber,
    receiptStatus: row.receiptStatus,
    allocations: allocationsByPayment.get(row.id) ?? [],
  }));
}

export async function getParentChildren(
  parentUserId: string,
  db: DatabaseInstance = getDb()
): Promise<LinkedChildSummary[]> {
  const studentIds = await selectParentChildIds(parentUserId, db);
  if (studentIds.length === 0) return [];

  const [students, totals] = await Promise.all([
    Promise.all(studentIds.map((studentId) => selectStudentProfile(studentId, db))),
    selectLedgerTotals(studentIds, db),
  ]);
  return students
    .map((student) => toChildSummary(student, totals.get(student.studentId)))
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
}

export async function getStudentAccountForUser(
  userId: string,
  role: PortalRole,
  targetStudentId?: string,
  db: DatabaseInstance = getDb()
): Promise<PortalStudentAccount> {
  if (role === 'STUDENT') await assertStudentPortalEnabled();

  let studentId = targetStudentId;
  if (role === 'STUDENT' && !studentId) {
    const rows = await db
      .select({ id: schema.students.id })
      .from(schema.students)
      .where(eq(schema.students.userId, userId))
      .limit(1);
    studentId = rows[0]?.id;
  }
  if (!studentId) throw new ValidationError('A student record is required.');

  await assertStudentOwnership(userId, role, studentId, db);
  const [studentProfile, assessments, ledger, payments] = await Promise.all([
    selectStudentProfile(studentId, db),
    getStudentAssessments(studentId, { status: 'POSTED' }, db),
    getStudentLedger(studentId, db),
    listOwnedPayments(userId, role, db),
  ]);

  return {
    student: toChildSummary(studentProfile, {
      balance: ledger.balanceCentavos,
      paid: calculateNetPaidFromEntries(ledger.entries),
    }),
    assessments,
    ledger,
    payments: payments.filter((payment) => payment.studentId === studentId),
  };
}

export async function getOwnedReceiptPdfData(
  userId: string,
  role: PortalRole,
  receiptIdentifier: string,
  db: DatabaseInstance = getDb()
) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    receiptIdentifier
  );
  const receipts = await db
    .select({ id: schema.receipts.id, studentId: schema.payments.studentId })
    .from(schema.receipts)
    .innerJoin(schema.payments, eq(schema.payments.id, schema.receipts.paymentId))
    .where(
      isUuid
        ? eq(schema.receipts.id, receiptIdentifier)
        : eq(schema.receipts.receiptNumber, receiptIdentifier)
    )
    .limit(1);
  if (!receipts[0]) throw new NotFoundError('The receipt does not exist.');

  await assertStudentOwnership(userId, role, receipts[0].studentId, db);
  return getReceiptPdfData(receipts[0].id, db);
}

export class PortalService {
  static verifyParentChildAccess(
    parentUserId: string,
    targetStudentId: string,
    db: DatabaseInstance = getDb()
  ) {
    return assertStudentOwnership(parentUserId, 'PARENT', targetStudentId, db).then(() => true);
  }

  static verifyStudentAccess(
    studentUserId: string,
    targetStudentId: string,
    db: DatabaseInstance = getDb()
  ) {
    return assertStudentOwnership(studentUserId, 'STUDENT', targetStudentId, db).then(() => true);
  }

  static getParentChildren(parentUserId: string, db: DatabaseInstance = getDb()) {
    return getParentChildren(parentUserId, db);
  }
}
