import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb, type DatabaseClient, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import {
  assessmentGenerateInputSchema,
  assessmentListInputSchema,
  adjustmentInputSchema,
  type AssessmentGenerateInput,
  type AssessmentListInput,
  type AdjustmentInput,
} from '@/lib/assessments';
import { addCentavos, subtractCentavos } from '@/lib/utils/currency';
import { calculateAssessmentDueDate, evaluateDeadline } from '@/lib/deadlines';
import { getOrCreateSchoolSettings } from './administration.service';
import { AppError, NotFoundError, ValidationError } from '@/server/errors';
import { lockStudentForLedgerMutation } from './ledger.service';
import { NotificationService } from './notification.service';
import { lockFeeStructureForMutation } from './students-fees.service';

export type FeeItemInput = {
  feeCategoryId: string;
  name: string;
  amountCentavos: number;
};

export type GenerateAssessmentInput = AssessmentGenerateInput;
export type { AdjustmentInput };

export type LedgerBalanceEntry = {
  assessmentId?: string | null;
  debitCentavos: number;
  creditCentavos: number;
};

export type AssessmentBalanceReconciliation = {
  studentBalanceCentavos: number;
  attributedBalanceCentavos: number;
  assessmentBalances: Map<string, number>;
  isReconciled: boolean;
};

export function calculateBalanceFromEntries(
  entries: Array<{ debitCentavos: number; creditCentavos: number }>
): number {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of entries) {
    totalDebits = addCentavos(totalDebits, entry.debitCentavos);
    totalCredits = addCentavos(totalCredits, entry.creditCentavos);
  }

  return subtractCentavos(totalDebits, totalCredits);
}

/** Calculates each assessment's net persisted ledger balance from its attributed entries. */
export function calculateAssessmentBalances(entries: LedgerBalanceEntry[]) {
  const balances = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.assessmentId) continue;
    const current = balances.get(entry.assessmentId) ?? 0;
    balances.set(
      entry.assessmentId,
      addCentavos(current, subtractCentavos(entry.debitCentavos, entry.creditCentavos))
    );
  }
  return balances;
}

/** Reconciles the student-wide balance to all assessment-attributed ledger balances. */
export function reconcileStudentAssessmentBalances(
  entries: LedgerBalanceEntry[]
): AssessmentBalanceReconciliation {
  const studentBalanceCentavos = calculateBalanceFromEntries(entries);
  const assessmentBalances = calculateAssessmentBalances(entries);
  const attributedBalanceCentavos = [...assessmentBalances.values()].reduce(
    (total, balance) => addCentavos(total, balance),
    0
  );
  return {
    studentBalanceCentavos,
    attributedBalanceCentavos,
    assessmentBalances,
    isReconciled: studentBalanceCentavos === attributedBalanceCentavos,
  };
}

export function assertStudentAssessmentReconciliation(
  reconciliation: AssessmentBalanceReconciliation
) {
  if (
    !reconciliation.isReconciled ||
    reconciliation.studentBalanceCentavos < 0 ||
    [...reconciliation.assessmentBalances.values()].some((balance) => balance < 0)
  ) {
    throw new ValidationError(
      'The student ledger is not reconciled to non-negative assessment balances.'
    );
  }
}

async function insertAuditLog(
  db: DatabaseClient,
  input: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    details: Record<string, unknown>;
  }
) {
  await db.insert(schema.auditLogs).values({
    userId: input.userId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: JSON.stringify(input.details),
  });
}

async function selectStudent(studentId: string, db: DatabaseClient) {
  const rows = await db
    .select({
      id: schema.students.id,
      firstName: schema.students.firstName,
      lastName: schema.students.lastName,
      studentNumber: schema.students.studentNumber,
      gradeLevelId: schema.students.gradeLevelId,
      schoolYearId: schema.students.schoolYearId,
      status: schema.students.status,
    })
    .from(schema.students)
    .where(eq(schema.students.id, studentId))
    .limit(1);
  if (!rows[0]) throw new NotFoundError('The student record does not exist.');
  return rows[0];
}

async function selectAssessment(id: string, db: DatabaseClient) {
  const rows = await db
    .select({
      id: schema.studentAssessments.id,
      studentId: schema.studentAssessments.studentId,
      schoolYearId: schema.studentAssessments.schoolYearId,
      feeStructureId: schema.studentAssessments.feeStructureId,
      assessmentPeriod: schema.studentAssessments.assessmentPeriod,
      totalAmountCentavos: schema.studentAssessments.totalAmountCentavos,
      status: schema.studentAssessments.status,
      dueDate: schema.studentAssessments.dueDate,
      createdAt: schema.studentAssessments.createdAt,
      updatedAt: schema.studentAssessments.updatedAt,
      studentNumber: schema.students.studentNumber,
      studentFirstName: schema.students.firstName,
      studentLastName: schema.students.lastName,
      schoolYearName: schema.schoolYears.name,
      feeStructureName: schema.feeStructures.name,
    })
    .from(schema.studentAssessments)
    .innerJoin(schema.students, eq(schema.students.id, schema.studentAssessments.studentId))
    .innerJoin(
      schema.schoolYears,
      eq(schema.schoolYears.id, schema.studentAssessments.schoolYearId)
    )
    .innerJoin(
      schema.feeStructures,
      eq(schema.feeStructures.id, schema.studentAssessments.feeStructureId)
    )
    .where(eq(schema.studentAssessments.id, id))
    .limit(1);
  if (!rows[0]) throw new NotFoundError('The assessment does not exist.');
  return rows[0];
}

async function selectAssessmentItems(assessmentId: string, db: DatabaseInstance) {
  return db
    .select({
      id: schema.assessmentItems.id,
      assessmentId: schema.assessmentItems.assessmentId,
      feeCategoryId: schema.assessmentItems.feeCategoryId,
      name: schema.assessmentItems.name,
      amountCentavos: schema.assessmentItems.amountCentavos,
      createdAt: schema.assessmentItems.createdAt,
      feeCategoryName: schema.feeCategories.name,
      feeCategoryCode: schema.feeCategories.code,
    })
    .from(schema.assessmentItems)
    .innerJoin(
      schema.feeCategories,
      eq(schema.feeCategories.id, schema.assessmentItems.feeCategoryId)
    )
    .where(eq(schema.assessmentItems.assessmentId, assessmentId))
    .orderBy(asc(schema.assessmentItems.createdAt));
}

async function selectLedgerEntries(studentId: string, db: DatabaseInstance) {
  return db
    .select()
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.studentId, studentId))
    .orderBy(asc(schema.ledgerEntries.createdAt));
}

export async function getAssessment(id: string, db: DatabaseInstance = getDb()) {
  const assessment = await selectAssessment(id, db);
  const [items, ledgerEntries] = await Promise.all([
    selectAssessmentItems(id, db),
    db
      .select()
      .from(schema.ledgerEntries)
      .where(
        and(
          eq(schema.ledgerEntries.studentId, assessment.studentId),
          eq(schema.ledgerEntries.assessmentId, id)
        )
      )
      .orderBy(asc(schema.ledgerEntries.createdAt)),
  ]);
  const balanceCentavos = calculateBalanceFromEntries(ledgerEntries);
  const settings = await getOrCreateSchoolSettings(db);
  return {
    ...assessment,
    items,
    balanceCentavos,
    ...evaluateDeadline({
      balanceCentavos,
      dueDate: assessment.dueDate,
      reminderLeadDays: settings.reminderLeadDays,
    }),
    ledgerEntries,
  };
}

export async function getStudentAssessments(
  studentId: string,
  input: AssessmentListInput = {},
  db: DatabaseInstance = getDb()
) {
  await selectStudent(studentId, db);
  const values = assessmentListInputSchema.parse(input);
  const conditions = [eq(schema.studentAssessments.studentId, studentId)];
  if (values.status) conditions.push(eq(schema.studentAssessments.status, values.status));

  const assessments = await db
    .select({
      id: schema.studentAssessments.id,
      studentId: schema.studentAssessments.studentId,
      schoolYearId: schema.studentAssessments.schoolYearId,
      feeStructureId: schema.studentAssessments.feeStructureId,
      assessmentPeriod: schema.studentAssessments.assessmentPeriod,
      totalAmountCentavos: schema.studentAssessments.totalAmountCentavos,
      status: schema.studentAssessments.status,
      dueDate: schema.studentAssessments.dueDate,
      createdAt: schema.studentAssessments.createdAt,
      updatedAt: schema.studentAssessments.updatedAt,
      schoolYearName: schema.schoolYears.name,
      feeStructureName: schema.feeStructures.name,
    })
    .from(schema.studentAssessments)
    .innerJoin(
      schema.schoolYears,
      eq(schema.schoolYears.id, schema.studentAssessments.schoolYearId)
    )
    .innerJoin(
      schema.feeStructures,
      eq(schema.feeStructures.id, schema.studentAssessments.feeStructureId)
    )
    .where(and(...conditions))
    .orderBy(asc(schema.studentAssessments.createdAt));

  if (assessments.length === 0) return [];
  const assessmentIds = assessments.map((assessment) => assessment.id);
  const [items, ledgerEntries] = await Promise.all([
    db
      .select({
        id: schema.assessmentItems.id,
        assessmentId: schema.assessmentItems.assessmentId,
        feeCategoryId: schema.assessmentItems.feeCategoryId,
        name: schema.assessmentItems.name,
        amountCentavos: schema.assessmentItems.amountCentavos,
        createdAt: schema.assessmentItems.createdAt,
        feeCategoryName: schema.feeCategories.name,
        feeCategoryCode: schema.feeCategories.code,
      })
      .from(schema.assessmentItems)
      .innerJoin(
        schema.feeCategories,
        eq(schema.feeCategories.id, schema.assessmentItems.feeCategoryId)
      )
      .where(inArray(schema.assessmentItems.assessmentId, assessmentIds))
      .orderBy(asc(schema.assessmentItems.createdAt)),
    db
      .select()
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.studentId, studentId))
      .orderBy(asc(schema.ledgerEntries.createdAt)),
  ]);

  const settings = await getOrCreateSchoolSettings(db);
  return assessments.map((assessment) => {
    const assessmentLedger = ledgerEntries.filter((entry) => entry.assessmentId === assessment.id);
    const balanceCentavos = calculateBalanceFromEntries(assessmentLedger);
    return {
      ...assessment,
      items: items.filter((item) => item.assessmentId === assessment.id),
      balanceCentavos,
      ...evaluateDeadline({
        balanceCentavos,
        dueDate: assessment.dueDate,
        reminderLeadDays: settings.reminderLeadDays,
      }),
    };
  });
}

export async function getStudentLedger(studentId: string, db: DatabaseInstance = getDb()) {
  await selectStudent(studentId, db);
  const entries = await selectLedgerEntries(studentId, db);
  return {
    entries,
    balanceCentavos: calculateBalanceFromEntries(entries),
  };
}

export class AssessmentService {
  static async generateAssessment(input: GenerateAssessmentInput, db: DatabaseInstance = getDb()) {
    const values = assessmentGenerateInputSchema.parse(input);
    const actorUserId = input.actorUserId;
    if (!actorUserId) {
      throw new ValidationError('An authenticated user is required to post an assessment.');
    }
    const created = await db.transaction(async (tx) => {
      const student = await lockStudentForLedgerMutation(values.studentId, tx);
      if (student.status !== 'ACTIVE') {
        throw new ValidationError('Only active students can receive a new assessment.');
      }
      // When both rows are needed, the invariant is student lock -> fee structure lock.
      await lockFeeStructureForMutation(values.feeStructureId, tx);
      const structures = await tx
        .select({
          id: schema.feeStructures.id,
          schoolYearId: schema.feeStructures.schoolYearId,
          gradeLevelId: schema.feeStructures.gradeLevelId,
          assessmentPeriod: schema.feeStructures.assessmentPeriod,
          name: schema.feeStructures.name,
          status: schema.feeStructures.status,
          schoolYearStatus: schema.schoolYears.status,
        })
        .from(schema.feeStructures)
        .innerJoin(schema.schoolYears, eq(schema.schoolYears.id, schema.feeStructures.schoolYearId))
        .where(eq(schema.feeStructures.id, values.feeStructureId))
        .limit(1);
      const structure = structures[0];
      if (!structure) throw new NotFoundError('The selected fee structure does not exist.');
      if (values.schoolYearId && values.schoolYearId !== structure.schoolYearId) {
        throw new ValidationError('The fee structure does not belong to the selected school year.');
      }
      if (structure.status !== 'ACTIVE' || structure.schoolYearStatus !== 'ACTIVE') {
        throw new ValidationError(
          'Only an active fee structure in an active school year can be posted.'
        );
      }
      if (student.schoolYearId && student.schoolYearId !== structure.schoolYearId) {
        throw new ValidationError(
          'The fee structure belongs to a different school year than the student.'
        );
      }
      if (student.gradeLevelId && student.gradeLevelId !== structure.gradeLevelId) {
        throw new ValidationError(
          'The fee structure belongs to a different grade level than the student.'
        );
      }

      const items = await tx
        .select({
          feeCategoryId: schema.feeStructureItems.feeCategoryId,
          name: schema.feeStructureItems.name,
          amountCentavos: schema.feeStructureItems.amountCentavos,
        })
        .from(schema.feeStructureItems)
        .innerJoin(
          schema.feeCategories,
          eq(schema.feeCategories.id, schema.feeStructureItems.feeCategoryId)
        )
        .where(eq(schema.feeStructureItems.feeStructureId, structure.id))
        .orderBy(asc(schema.feeStructureItems.createdAt));
      if (items.length === 0)
        throw new ValidationError('The fee structure has no fee items to post.');

      const totalAmountCentavos = items.reduce(
        (total, item) => addCentavos(total, item.amountCentavos),
        0
      );
      const settings = await getOrCreateSchoolSettings(tx);
      const dueDate =
        values.dueDate ?? calculateAssessmentDueDate(new Date(), settings.defaultPaymentTermDays);

      const existing = await tx
        .select({ id: schema.studentAssessments.id })
        .from(schema.studentAssessments)
        .where(
          and(
            eq(schema.studentAssessments.studentId, values.studentId),
            eq(schema.studentAssessments.schoolYearId, structure.schoolYearId),
            eq(schema.studentAssessments.assessmentPeriod, structure.assessmentPeriod)
          )
        )
        .limit(1);
      if (existing[0]) {
        throw new ValidationError('An assessment already exists for this student and period.');
      }

      const [assessment] = await tx
        .insert(schema.studentAssessments)
        .values({
          studentId: values.studentId,
          schoolYearId: structure.schoolYearId,
          feeStructureId: structure.id,
          assessmentPeriod: structure.assessmentPeriod,
          totalAmountCentavos,
          status: 'POSTED',
          dueDate,
        })
        .returning();
      if (!assessment) throw new AppError('The assessment could not be created.');

      await tx.insert(schema.assessmentItems).values(
        items.map((item, index) => ({
          ...item,
          assessmentId: assessment.id,
          // Preserve fee-structure order when PostgreSQL assigns the same
          // timestamp to items inserted in one transaction.
          createdAt: new Date(assessment.createdAt.getTime() + index),
        }))
      );
      const priorEntries = await tx
        .select({
          debitCentavos: schema.ledgerEntries.debitCentavos,
          creditCentavos: schema.ledgerEntries.creditCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, values.studentId));
      const nextBalance = addCentavos(
        calculateBalanceFromEntries(priorEntries),
        totalAmountCentavos
      );
      await tx.insert(schema.ledgerEntries).values({
        studentId: values.studentId,
        assessmentId: assessment.id,
        entryType: 'ASSESSMENT',
        debitCentavos: totalAmountCentavos,
        creditCentavos: 0,
        balanceCentavos: nextBalance,
        description: `Assessment posted from ${structure.name}`,
      });
      await insertAuditLog(tx, {
        userId: actorUserId,
        action: 'ASSESSMENT_POSTED',
        entityType: 'ASSESSMENT',
        entityId: assessment.id,
        details: {
          feeStructureId: structure.id,
          assessmentPeriod: structure.assessmentPeriod,
          totalAmountCentavos,
          itemCount: items.length,
          dueDate,
        },
      });
      return assessment;
    });

    const assessment = await getAssessment(created.id, db);
    await NotificationService.notifyAssessmentPosted(created.id, db);
    return assessment;
  }

  static async applyAdjustment(input: AdjustmentInput, db: DatabaseInstance = getDb()) {
    const values = adjustmentInputSchema.parse(input);
    const actorUserId = input.actorUserId;
    if (!actorUserId) {
      throw new ValidationError('An authenticated approver is required for an adjustment.');
    }
    const created = await db.transaction(async (tx) => {
      await lockStudentForLedgerMutation(values.studentId, tx);
      const assessment = await selectAssessment(values.assessmentId, tx);
      if (assessment.studentId !== values.studentId) {
        throw new ValidationError('The adjustment student does not match the assessment.');
      }

      const entries = await tx
        .select({
          assessmentId: schema.ledgerEntries.assessmentId,
          debitCentavos: schema.ledgerEntries.debitCentavos,
          creditCentavos: schema.ledgerEntries.creditCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, values.studentId));
      const reconciliation = reconcileStudentAssessmentBalances(entries);
      assertStudentAssessmentReconciliation(reconciliation);
      const currentBalance = reconciliation.studentBalanceCentavos;
      const assessmentBalance = reconciliation.assessmentBalances.get(values.assessmentId) ?? 0;
      if (values.type === 'CREDIT' && values.amountCentavos > assessmentBalance) {
        throw new ValidationError(
          'A credit adjustment cannot reduce the assessment balance below zero.'
        );
      }
      const nextBalance =
        values.type === 'DEBIT'
          ? addCentavos(currentBalance, values.amountCentavos)
          : subtractCentavos(currentBalance, values.amountCentavos);
      const [adjustment] = await tx
        .insert(schema.adjustments)
        .values({
          assessmentId: values.assessmentId,
          studentId: values.studentId,
          type: values.type,
          amountCentavos: values.amountCentavos,
          reason: values.reason,
          approvedByUserId: actorUserId ?? null,
        })
        .returning();
      if (!adjustment) throw new AppError('The adjustment could not be created.');
      await tx.insert(schema.ledgerEntries).values({
        studentId: values.studentId,
        assessmentId: values.assessmentId,
        entryType: values.type === 'DEBIT' ? 'DEBIT_ADJUSTMENT' : 'CREDIT_ADJUSTMENT',
        debitCentavos: values.type === 'DEBIT' ? values.amountCentavos : 0,
        creditCentavos: values.type === 'CREDIT' ? values.amountCentavos : 0,
        balanceCentavos: nextBalance,
        description: values.reason,
      });
      await insertAuditLog(tx, {
        userId: actorUserId,
        action: 'ASSESSMENT_ADJUSTED',
        entityType: 'ADJUSTMENT',
        entityId: adjustment.id,
        details: {
          assessmentId: values.assessmentId,
          studentId: values.studentId,
          type: values.type,
          amountCentavos: values.amountCentavos,
          reason: values.reason,
        },
      });
      return { adjustment, balanceCentavos: nextBalance };
    });

    return created;
  }
}
