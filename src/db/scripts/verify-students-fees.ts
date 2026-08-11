import dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../index';
import * as schema from '../schema';
import { logSanitizedError } from '../../server/logging';
import { calculateAssessmentDueDate } from '../../lib/deadlines';
import {
  createFeeCategory,
  createFeeStructure,
  createGuardian,
  createStudent,
  getFeeStructure,
  getGuardian,
  getStudent,
  linkGuardianStudent,
  unlinkGuardianStudent,
  updateFeeStructure,
} from '../../server/services/students-fees.service';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function assertCheck(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for students and fees verification.');
  }

  const db = getDb(process.env.DATABASE_URL);
  const stamp = Date.now();
  const checks: string[] = [];
  const createdStudentIds: string[] = [];
  const createdGuardianIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdStructureIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdAssessmentIds: string[] = [];

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
  const parentUser = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, 'parent@demo.school'))
    .limit(1);
  const studentUser = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, 'student@demo.school'))
    .limit(1);

  assertCheck(Boolean(activeSchoolYear[0]), 'Seed data must include an active school year.');
  assertCheck(Boolean(gradeLevel[0]), 'Seed data must include a grade level.');
  assertCheck(Boolean(parentUser[0]), 'Seed data must include the demo parent account.');
  assertCheck(Boolean(studentUser[0]), 'Seed data must include the demo student account.');

  try {
    const studentNumber = `VERIFY-${stamp}`;
    const verificationUserId = randomUUID();
    const [verificationUser] = await db
      .insert(schema.users)
      .values({
        id: verificationUserId,
        name: 'Students and fees verification user',
        email: `students-fees-${stamp}@example.com`,
        role: 'STUDENT',
        active: true,
        emailVerified: true,
      })
      .returning({ id: schema.users.id });
    if (!verificationUser) throw new Error('Verification student account could not be created.');
    createdUserIds.push(verificationUser.id);
    const student = await createStudent(
      {
        studentNumber,
        firstName: 'Phase Four',
        lastName: 'Student',
        email: `phase-four-student-${stamp}@example.com`,
        userId: verificationUser.id,
        gradeLevelId: gradeLevel[0].id,
        sectionId: null,
        schoolYearId: activeSchoolYear[0].id,
        status: 'ACTIVE',
      },
      db
    );
    createdStudentIds.push(student.id);

    const persistedStudent = await getStudent(student.id, db);
    assertCheck(
      persistedStudent.studentNumber === studentNumber,
      'Student did not persist across reads.'
    );
    assertCheck(
      persistedStudent.userId === verificationUser.id,
      'Student account link did not persist.'
    );

    let duplicateStudentRejected = false;
    try {
      await createStudent(
        {
          studentNumber,
          firstName: 'Duplicate',
          lastName: 'Student',
          email: `duplicate-${stamp}@example.com`,
          userId: null,
          gradeLevelId: null,
          sectionId: null,
          schoolYearId: null,
          status: 'ACTIVE',
        },
        db
      );
    } catch {
      duplicateStudentRejected = true;
    }
    assertCheck(duplicateStudentRejected, 'Duplicate student numbers were accepted.');
    checks.push('student persistence, account link, and duplicate student-number rejection');

    const verificationGuardianUserId = randomUUID();
    const [verificationGuardianUser] = await db
      .insert(schema.users)
      .values({
        id: verificationGuardianUserId,
        name: 'Students and fees verification guardian',
        email: `students-fees-guardian-${stamp}@example.com`,
        role: 'PARENT',
        active: true,
        emailVerified: true,
      })
      .returning({ id: schema.users.id });
    if (!verificationGuardianUser)
      throw new Error('Verification guardian account could not be created.');
    createdUserIds.push(verificationGuardianUser.id);
    const guardian = await createGuardian(
      {
        firstName: 'Phase Four',
        lastName: 'Guardian',
        email: `phase-four-guardian-${stamp}@example.com`,
        phone: '09170000000',
        relationship: 'Parent',
        address: 'Verification address',
        userId: verificationGuardianUser.id,
      },
      db
    );
    createdGuardianIds.push(guardian.id);
    await linkGuardianStudent(
      { guardianId: guardian.id, studentId: student.id, isPrimary: true },
      db
    );
    const persistedGuardian = await getGuardian(guardian.id, db);
    assertCheck(
      persistedGuardian.userId === verificationGuardianUser.id,
      'Parent account link did not persist.'
    );
    assertCheck(
      persistedGuardian.students.some(
        (linkedStudent) => linkedStudent.id === student.id && linkedStudent.isPrimary
      ),
      'Guardian-student link did not persist as primary.'
    );

    const replacementGuardian = await createGuardian(
      {
        firstName: 'Phase Four Replacement',
        lastName: 'Guardian',
        email: `phase-four-replacement-${stamp}@example.com`,
        phone: '09170000001',
        relationship: 'Parent',
        address: 'Verification replacement address',
        userId: null,
      },
      db
    );
    createdGuardianIds.push(replacementGuardian.id);
    await linkGuardianStudent(
      { guardianId: replacementGuardian.id, studentId: student.id, isPrimary: true },
      db
    );
    const primaryLinks = await db
      .select({ id: schema.guardianStudents.id })
      .from(schema.guardianStudents)
      .where(
        and(
          eq(schema.guardianStudents.studentId, student.id),
          eq(schema.guardianStudents.isPrimary, true)
        )
      );
    assertCheck(primaryLinks.length === 1, 'A student could have more than one primary guardian.');

    let duplicateLinkRejected = false;
    try {
      await linkGuardianStudent(
        { guardianId: guardian.id, studentId: student.id, isPrimary: false },
        db
      );
    } catch {
      duplicateLinkRejected = true;
    }
    assertCheck(duplicateLinkRejected, 'Duplicate guardian-student links were accepted.');
    checks.push(
      'guardian persistence, parent account link, primary replacement, and duplicate-link rejection'
    );

    const category = await createFeeCategory(
      {
        name: `Phase Four Tuition ${stamp}`,
        code: `VERIFY-${stamp}`,
        description: 'Phase 4 verification category',
        status: 'ACTIVE',
      },
      db
    );
    createdCategoryIds.push(category.id);

    const draftStructure = await createFeeStructure(
      {
        schoolYearId: activeSchoolYear[0].id,
        gradeLevelId: gradeLevel[0].id,
        assessmentPeriod: 'ANNUAL',
        name: `Phase Four Draft ${stamp}`,
        status: 'DRAFT',
        items: [{ feeCategoryId: category.id, name: 'Tuition', amountCentavos: 120000 }],
      },
      db
    );
    createdStructureIds.push(draftStructure.id);
    assertCheck(
      draftStructure.status === 'DRAFT',
      'Draft fee structure did not persist its status.'
    );
    const activeStructure = await updateFeeStructure(draftStructure.id, { status: 'ACTIVE' }, db);
    assertCheck(
      activeStructure.status === 'ACTIVE',
      'Draft fee structure could not become active.'
    );

    const lockedStructure = await createFeeStructure(
      {
        schoolYearId: activeSchoolYear[0].id,
        gradeLevelId: gradeLevel[0].id,
        assessmentPeriod: 'SEMESTER',
        name: `Phase Four Locked ${stamp}`,
        status: 'ACTIVE',
        items: [{ feeCategoryId: category.id, name: 'Semester tuition', amountCentavos: 60000 }],
      },
      db
    );
    createdStructureIds.push(lockedStructure.id);

    const [assessment] = await db
      .insert(schema.studentAssessments)
      .values({
        studentId: student.id,
        schoolYearId: activeSchoolYear[0].id,
        feeStructureId: lockedStructure.id,
        assessmentPeriod: 'SEMESTER',
        totalAmountCentavos: 60000,
        status: 'POSTED',
        dueDate: calculateAssessmentDueDate(new Date(), 7),
      })
      .returning();
    createdAssessmentIds.push(assessment.id);

    let postedEditRejected = false;
    try {
      await updateFeeStructure(lockedStructure.id, { name: `Unsafe edit ${stamp}` }, db);
    } catch {
      postedEditRejected = true;
    }
    assertCheck(postedEditRejected, 'Posted-assessment fee structure edits were not locked.');
    const archivedLockedStructure = await updateFeeStructure(
      lockedStructure.id,
      { status: 'ARCHIVED' },
      db
    );
    assertCheck(
      archivedLockedStructure.status === 'ARCHIVED',
      'A posted-assessment fee structure could not be archived safely.'
    );
    const persistedStructure = await getFeeStructure(lockedStructure.id, db);
    assertCheck(
      persistedStructure.items.length === 1,
      'Fee structure items did not persist across reads.'
    );
    checks.push('fee category, draft/active lifecycle, posted-assessment lock, and safe archive');
  } finally {
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
      await db
        .delete(schema.guardianStudents)
        .where(eq(schema.guardianStudents.studentId, studentId));
    }
    for (const guardianId of createdGuardianIds) {
      await db
        .delete(schema.guardianStudents)
        .where(eq(schema.guardianStudents.guardianId, guardianId));
      await db.delete(schema.guardians).where(eq(schema.guardians.id, guardianId));
    }
    for (const studentId of createdStudentIds) {
      await db.delete(schema.students).where(eq(schema.students.id, studentId));
    }
    for (const userId of createdUserIds) {
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
    for (const categoryId of createdCategoryIds) {
      await db.delete(schema.feeCategories).where(eq(schema.feeCategories.id, categoryId));
    }
  }

  console.log(`Students and fees contract verified: ${checks.join(', ')}.`);
}

main().catch((error) => {
  logSanitizedError('verification.students_fees', error);
  process.exitCode = 1;
});
