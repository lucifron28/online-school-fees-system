import dotenv from 'dotenv';
import path from 'path';
import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import * as schema from '../schema';
import type { SchoolSettingsInput } from '../../lib/administration';
import {
  activateSchoolYear,
  createGradeLevel,
  createSchoolYear,
  createSection,
  createUser,
  getAdministrationSnapshot,
  isStudentPortalEnabled,
  listSections,
  listUsers,
  listSchoolYears,
  updateGradeLevel,
  updateSchoolSettings,
  updateSchoolYear,
  updateSection,
  updateUser,
} from '../../server/services/administration.service';
import { createAuth } from '../../lib/auth/server';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function assertCheck(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function settingsInput(
  settings: Awaited<ReturnType<typeof getAdministrationSnapshot>>['settings']
): SchoolSettingsInput {
  return {
    schoolName: settings.schoolName,
    shortName: settings.shortName,
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    receiptPrefix: settings.receiptPrefix,
    currencyCode: 'PHP',
    timezone: 'Asia/Manila',
    studentPortalEnabled: settings.studentPortalEnabled,
    activeSchoolYearId: settings.activeSchoolYearId,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for administration verification.');
  }

  const db = getDb(process.env.DATABASE_URL);
  const stamp = Date.now();
  const checks: string[] = [];
  const createdYearIds: string[] = [];
  const createdSectionIds: string[] = [];
  let createdGradeId: string | undefined;
  let createdUserId: string | undefined;

  const original = await getAdministrationSnapshot(db);
  const originalSettings = settingsInput(original.settings);
  const originalActiveSchoolYearId = original.settings.activeSchoolYearId;

  try {
    await updateSchoolSettings(
      {
        ...originalSettings,
        schoolName: `Administration Verification ${stamp}`,
        studentPortalEnabled: false,
      },
      db
    );
    const refreshedSettings = await getAdministrationSnapshot(db);
    assertCheck(
      refreshedSettings.settings.schoolName === `Administration Verification ${stamp}`,
      'Institution settings did not persist across reads.'
    );
    assertCheck(
      (await isStudentPortalEnabled(db)) === false,
      'The persisted student portal flag did not disable student access.'
    );
    checks.push('settings persistence and student portal flag');

    const firstYear = await createSchoolYear(
      {
        name: `Administration Verification ${stamp} A`,
        startDate: '2026-06-01',
        endDate: '2027-03-31',
      },
      db
    );
    createdYearIds.push(firstYear.id);
    const secondYear = await createSchoolYear(
      {
        name: `Administration Verification ${stamp} B`,
        startDate: '2027-06-01',
        endDate: '2028-03-31',
      },
      db
    );
    createdYearIds.push(secondYear.id);

    const updatedSecondYear = await updateSchoolYear(
      secondYear.id,
      {
        name: `Administration Verification ${stamp} B Updated`,
        startDate: '2027-06-01',
        endDate: '2028-04-15',
      },
      db
    );
    assertCheck(
      updatedSecondYear.name === `Administration Verification ${stamp} B Updated`,
      'School-year updates did not persist.'
    );

    await activateSchoolYear(firstYear.id, db);
    await activateSchoolYear(secondYear.id, db);
    const schoolYears = await listSchoolYears(db);
    assertCheck(
      schoolYears.filter((schoolYear) => schoolYear.status === 'ACTIVE').length === 1,
      'School-year activation allowed more than one active year.'
    );
    assertCheck(
      schoolYears.find((schoolYear) => schoolYear.id === firstYear.id)?.status === 'ARCHIVED',
      'Activating a new school year did not archive the previous active year.'
    );
    assertCheck(
      schoolYears.find((schoolYear) => schoolYear.id === secondYear.id)?.status === 'ACTIVE',
      'The selected school year was not activated.'
    );
    checks.push('school-year lifecycle and single-active invariant');

    const grade = await createGradeLevel(
      {
        name: `Verification Grade ${stamp}`,
        code: `VERIFY-${stamp}`,
        displayOrder: 998,
      },
      db
    );
    createdGradeId = grade.id;
    const updatedGrade = await updateGradeLevel(
      grade.id,
      {
        name: `Verification Grade ${stamp} Updated`,
        code: `VERIFY-${stamp}`,
        displayOrder: 999,
      },
      db
    );
    assertCheck(updatedGrade.displayOrder === 999, 'Grade-level updates did not persist.');

    const section = await createSection(
      {
        gradeLevelId: grade.id,
        schoolYearId: secondYear.id,
        name: `Verification Section ${stamp}`,
        code: `VERIFY-${stamp}`,
      },
      db
    );
    createdSectionIds.push(section.id);
    const updatedSection = await updateSection(
      section.id,
      {
        gradeLevelId: grade.id,
        schoolYearId: secondYear.id,
        name: `Verification Section ${stamp} Updated`,
        code: `VERIFY-${stamp}-UPDATED`,
      },
      db
    );
    assertCheck(
      updatedSection.name === `Verification Section ${stamp} Updated`,
      'Section updates did not persist.'
    );

    let duplicateRejected = false;
    try {
      await createSection(
        {
          gradeLevelId: grade.id,
          schoolYearId: secondYear.id,
          name: `Duplicate Section ${stamp}`,
          code: `VERIFY-${stamp}-UPDATED`,
        },
        db
      );
    } catch {
      duplicateRejected = true;
    }
    assertCheck(duplicateRejected, 'Duplicate section codes were accepted.');

    let archivedRejected = false;
    try {
      await createSection(
        {
          gradeLevelId: grade.id,
          schoolYearId: firstYear.id,
          name: `Archived Section ${stamp}`,
          code: `ARCHIVED-${stamp}`,
        },
        db
      );
    } catch {
      archivedRejected = true;
    }
    assertCheck(archivedRejected, 'Sections could be created for an archived school year.');
    assertCheck(
      (await listSections(db)).some((item) => item.id === section.id),
      'Section listing omitted the saved section.'
    );
    checks.push('grade-level and section persistence/constraints');

    const usersBefore = await listUsers(db);
    const adminActor = usersBefore.find((user) => user.role === 'ADMIN' && user.active);
    const createdUser = await createUser(
      {
        name: `Administration Verification ${stamp}`,
        email: `administration-verification-${stamp}@demo.school`,
        password: 'VerificationPass123!',
        role: 'PARENT',
      },
      db
    );
    createdUserId = createdUser.id;
    const updateActorId = adminActor?.id ?? 'administration-verification-actor';
    const promotedUser = await updateUser(
      createdUser.id,
      updateActorId,
      { role: 'FINANCE_STAFF' },
      db
    );
    assertCheck(promotedUser.role === 'FINANCE_STAFF', 'User role changes did not persist.');
    const disabledUser = await updateUser(createdUser.id, updateActorId, { active: false }, db);
    assertCheck(disabledUser.active === false, 'User deactivation did not persist.');

    const auth = createAuth({ database: db });
    const signInResponse = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: createdUser.email,
          password: 'VerificationPass123!',
          rememberMe: true,
        }),
      })
    );
    assertCheck(!signInResponse.ok, 'A disabled user was still able to sign in.');
    checks.push('supported account creation, roles, and disabled-account enforcement');

    let invalidSchoolYearRejected = false;
    try {
      await updateSchoolSettings({ ...originalSettings, activeSchoolYearId: firstYear.id }, db);
    } catch {
      invalidSchoolYearRejected = true;
    }
    assertCheck(
      invalidSchoolYearRejected,
      'Institution settings accepted an archived school year as active.'
    );
    checks.push('active-school-year reference constraint');
  } finally {
    if (originalActiveSchoolYearId) {
      await activateSchoolYear(originalActiveSchoolYearId, db);
    } else {
      await db
        .update(schema.schoolYears)
        .set({ status: 'ARCHIVED' })
        .where(eq(schema.schoolYears.status, 'ACTIVE'));
    }
    await updateSchoolSettings(originalSettings, db);
    if (createdUserId) {
      await db.delete(schema.accounts).where(eq(schema.accounts.userId, createdUserId));
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, createdUserId));
      await db.delete(schema.users).where(eq(schema.users.id, createdUserId));
    }
    for (const sectionId of createdSectionIds) {
      await db.delete(schema.sections).where(eq(schema.sections.id, sectionId));
    }
    if (createdGradeId) {
      await db.delete(schema.gradeLevels).where(eq(schema.gradeLevels.id, createdGradeId));
    }
    for (const yearId of createdYearIds) {
      await db.delete(schema.schoolYears).where(eq(schema.schoolYears.id, yearId));
    }
  }

  console.log(`Administration contract verified: ${checks.join(', ')}.`);
}

main().catch((error) => {
  console.error('Administration verification failed:', error);
  process.exitCode = 1;
});
