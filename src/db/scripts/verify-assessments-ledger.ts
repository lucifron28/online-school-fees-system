import dotenv from 'dotenv';
import path from 'path';
import { and, eq, inArray, or } from 'drizzle-orm';
import { getDb } from '../index';
import * as schema from '../schema';
import {
  createFeeCategory,
  createFeeStructure,
  createStudent,
} from '../../server/services/students-fees.service';
import {
  AssessmentService,
  calculateBalanceFromEntries,
  getAssessment,
  getStudentAssessments,
  getStudentLedger,
} from '../../server/services/assessment.service';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function assertCheck(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for assessments and ledger verification.');
  }

  const db = getDb(process.env.DATABASE_URL);
  const stamp = Date.now();
  const checks: string[] = [];
  const createdStudentIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdStructureIds: string[] = [];
  const createdAssessmentIds: string[] = [];
  const createdAdjustmentIds: string[] = [];

  const activeSchoolYear = await db
    .select({ id: schema.schoolYears.id })
    .from(schema.schoolYears)
    .where(eq(schema.schoolYears.status, 'ACTIVE'))
    .limit(1);
  const gradeLevel = await db
    .select({ id: schema.gradeLevels.id })
    .from(schema.gradeLevels)
    .orderBy(schema.gradeLevels.displayOrder)
    .limit(1);
  const adminUser = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, 'admin@demo.school'))
    .limit(1);

  assertCheck(Boolean(activeSchoolYear[0]), 'Seed data must include an active school year.');
  assertCheck(Boolean(gradeLevel[0]), 'Seed data must include a grade level.');
  assertCheck(Boolean(adminUser[0]), 'Seed data must include the demo admin account.');

  try {
    const category = await createFeeCategory(
      {
        name: `Phase Five Tuition ${stamp}`,
        code: `VERIFY-${stamp}`,
        description: 'Phase 5 assessment verification category',
        status: 'ACTIVE',
      },
      db
    );
    createdCategoryIds.push(category.id);

    const structure = await createFeeStructure(
      {
        schoolYearId: activeSchoolYear[0].id,
        gradeLevelId: gradeLevel[0].id,
        assessmentPeriod: 'ANNUAL',
        name: `Phase Five Annual ${stamp}`,
        status: 'ACTIVE',
        items: [{ feeCategoryId: category.id, name: 'Tuition snapshot', amountCentavos: 120000 }],
      },
      db
    );
    createdStructureIds.push(structure.id);

    const student = await createStudent(
      {
        studentNumber: `VERIFY-ASSESSMENT-${stamp}`,
        firstName: 'Phase Five',
        lastName: 'Student',
        email: `phase-five-student-${stamp}@example.com`,
        userId: null,
        gradeLevelId: gradeLevel[0].id,
        sectionId: null,
        schoolYearId: activeSchoolYear[0].id,
        status: 'ACTIVE',
      },
      db
    );
    createdStudentIds.push(student.id);

    const assessment = await AssessmentService.generateAssessment(
      {
        studentId: student.id,
        schoolYearId: activeSchoolYear[0].id,
        feeStructureId: structure.id,
        actorUserId: adminUser[0].id,
      },
      db
    );
    createdAssessmentIds.push(assessment.id);
    assertCheck(assessment.status === 'POSTED', 'Assessment was not posted.');
    assertCheck(
      assessment.totalAmountCentavos === 120000,
      'Assessment total did not use fee items.'
    );
    assertCheck(
      assessment.items[0]?.amountCentavos === 120000,
      'Assessment item snapshot was not persisted.'
    );
    const initialLedger = await getStudentLedger(student.id, db);
    assertCheck(
      initialLedger.balanceCentavos === 120000,
      'Initial ledger balance did not reconcile.'
    );
    assertCheck(initialLedger.entries.length === 1, 'Assessment should create one ledger entry.');
    checks.push(
      'authoritative fee loading, persisted assessment snapshot, and transactional ledger posting'
    );

    await db
      .update(schema.feeStructureItems)
      .set({ amountCentavos: 999999 })
      .where(eq(schema.feeStructureItems.feeStructureId, structure.id));
    const historicalAssessment = await getAssessment(assessment.id, db);
    assertCheck(
      historicalAssessment.items[0]?.amountCentavos === 120000,
      'Historical assessment amounts changed after the fee structure changed.'
    );
    checks.push('historical fee snapshot immutability');

    const beforeDuplicate = await getStudentAssessments(student.id, {}, db);
    let duplicateRejected = false;
    try {
      await AssessmentService.generateAssessment(
        {
          studentId: student.id,
          feeStructureId: structure.id,
          actorUserId: adminUser[0].id,
        },
        db
      );
    } catch {
      duplicateRejected = true;
    }
    const afterDuplicate = await getStudentAssessments(student.id, {}, db);
    assertCheck(duplicateRejected, 'Duplicate assessment generation was accepted.');
    assertCheck(
      afterDuplicate.length === beforeDuplicate.length,
      'Duplicate generation changed the assessment count.'
    );
    assertCheck(
      (await getStudentLedger(student.id, db)).entries.length === initialLedger.entries.length,
      'Duplicate generation changed the ledger.'
    );
    checks.push('database-backed duplicate prevention with no partial writes');

    const debitAdjustment = await AssessmentService.applyAdjustment(
      {
        assessmentId: assessment.id,
        studentId: student.id,
        type: 'DEBIT',
        amountCentavos: 30000,
        reason: 'Phase 5 debit verification',
        actorUserId: adminUser[0].id,
      },
      db
    );
    createdAdjustmentIds.push(debitAdjustment.adjustment.id);
    const creditAdjustment = await AssessmentService.applyAdjustment(
      {
        assessmentId: assessment.id,
        studentId: student.id,
        type: 'CREDIT',
        amountCentavos: 50000,
        reason: 'Phase 5 credit verification',
        actorUserId: adminUser[0].id,
      },
      db
    );
    createdAdjustmentIds.push(creditAdjustment.adjustment.id);
    const adjustedLedger = await getStudentLedger(student.id, db);
    assertCheck(
      adjustedLedger.balanceCentavos === 100000,
      'Adjusted ledger balance did not reconcile.'
    );
    assertCheck(
      calculateBalanceFromEntries(adjustedLedger.entries) === adjustedLedger.balanceCentavos,
      'Ledger running total does not match authoritative entries.'
    );

    let overCreditRejected = false;
    try {
      await AssessmentService.applyAdjustment(
        {
          assessmentId: assessment.id,
          studentId: student.id,
          type: 'CREDIT',
          amountCentavos: 100001,
          reason: 'This must be rejected',
          actorUserId: adminUser[0].id,
        },
        db
      );
    } catch {
      overCreditRejected = true;
    }
    assertCheck(overCreditRejected, 'Over-credit adjustment was accepted.');
    assertCheck(
      (await getStudentLedger(student.id, db)).entries.length === adjustedLedger.entries.length,
      'Rejected adjustment left a ledger entry behind.'
    );
    checks.push(
      'reasoned debit/credit adjustments, over-credit protection, and ledger reconciliation'
    );

    const auditRows = await db
      .select({ action: schema.auditLogs.action, entityId: schema.auditLogs.entityId })
      .from(schema.auditLogs)
      .where(
        or(
          eq(schema.auditLogs.entityId, assessment.id),
          inArray(schema.auditLogs.entityId, createdAdjustmentIds)
        )
      );
    assertCheck(
      auditRows.some((row) => row.action === 'ASSESSMENT_POSTED' && row.entityId === assessment.id),
      'Assessment posting audit event was not recorded.'
    );
    assertCheck(
      auditRows.filter((row) => row.action === 'ASSESSMENT_ADJUSTED').length === 2,
      'Adjustment audit events were not recorded for both adjustments.'
    );
    checks.push('assessment and adjustment audit events');

    const rollbackStudent = await createStudent(
      {
        studentNumber: `VERIFY-ROLLBACK-${stamp}`,
        firstName: 'Phase Five Rollback',
        lastName: 'Student',
        email: `phase-five-rollback-${stamp}@example.com`,
        userId: null,
        gradeLevelId: gradeLevel[0].id,
        sectionId: null,
        schoolYearId: activeSchoolYear[0].id,
        status: 'ACTIVE',
      },
      db
    );
    createdStudentIds.push(rollbackStudent.id);
    let rollbackRejected = false;
    try {
      await AssessmentService.generateAssessment(
        {
          studentId: rollbackStudent.id,
          feeStructureId: structure.id,
          actorUserId: `missing-audit-user-${stamp}`,
        },
        db
      );
    } catch {
      rollbackRejected = true;
    }
    assertCheck(rollbackRejected, 'The forced audit failure did not reject the transaction.');
    assertCheck(
      (await getStudentAssessments(rollbackStudent.id, {}, db)).length === 0,
      'Failed assessment transaction left an assessment behind.'
    );
    assertCheck(
      (await getStudentLedger(rollbackStudent.id, db)).entries.length === 0,
      'Failed assessment transaction left a ledger entry behind.'
    );
    checks.push('full rollback after a post-insert transaction failure');
  } finally {
    if (createdStudentIds.length > 0) {
      await db
        .delete(schema.ledgerEntries)
        .where(inArray(schema.ledgerEntries.studentId, createdStudentIds));
      await db
        .delete(schema.adjustments)
        .where(inArray(schema.adjustments.studentId, createdStudentIds));
      await db
        .delete(schema.auditLogs)
        .where(
          or(
            inArray(schema.auditLogs.entityId, createdAssessmentIds),
            inArray(schema.auditLogs.entityId, createdAdjustmentIds)
          )
        );
    }
    for (const assessmentId of createdAssessmentIds) {
      await db
        .delete(schema.assessmentItems)
        .where(eq(schema.assessmentItems.assessmentId, assessmentId));
      await db
        .delete(schema.studentAssessments)
        .where(eq(schema.studentAssessments.id, assessmentId));
    }
    for (const structureId of createdStructureIds) {
      await db
        .delete(schema.feeStructureItems)
        .where(eq(schema.feeStructureItems.feeStructureId, structureId));
      await db.delete(schema.feeStructures).where(eq(schema.feeStructures.id, structureId));
    }
    for (const studentId of createdStudentIds) {
      await db.delete(schema.students).where(eq(schema.students.id, studentId));
    }
    for (const categoryId of createdCategoryIds) {
      await db.delete(schema.feeCategories).where(eq(schema.feeCategories.id, categoryId));
    }
  }

  console.log(`Assessments and ledger contract verified: ${checks.join(', ')}.`);
}

main().catch((error) => {
  console.error('Assessments and ledger verification failed:', error);
  process.exitCode = 1;
});
