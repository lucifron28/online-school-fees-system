import { and, eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import path from 'path';
import { createAuth } from '../../lib/auth/server';
import { getReceiptProcessorName, receiptSnapshotSchema } from '../../lib/receipt-snapshot';
import { getDb, type DatabaseInstance } from '../index';
import * as schema from '../schema';
import { logSanitizedError } from '../../server/logging';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const DEMO_PASSWORD = 'DemoPass123!';
export const DEMO_SCHOOL_YEAR_NAME = 'SY 2026–2027';
export const DEMO_STUDENT_COUNT = 20;
export const DEMO_GUARDIAN_COUNT = 10;

const DEMO_NOW = new Date('2026-08-01T09:00:00+08:00');
const DEMO_EXPIRY = new Date('2026-09-01T09:00:00+08:00');

const gradesData = [
  { name: 'Grade 7', code: 'G7', displayOrder: 7 },
  { name: 'Grade 8', code: 'G8', displayOrder: 8 },
  { name: 'Grade 9', code: 'G9', displayOrder: 9 },
  { name: 'Grade 10', code: 'G10', displayOrder: 10 },
  { name: 'Grade 11', code: 'G11', displayOrder: 11 },
  { name: 'Grade 12', code: 'G12', displayOrder: 12 },
] as const;

const feeCategoriesData = [
  { name: 'Tuition', code: 'TUITION', description: 'Core annual tuition' },
  { name: 'Laboratory', code: 'LAB', description: 'Laboratory and learning materials' },
  { name: 'Activities', code: 'ACTIVITY', description: 'Student activities and events' },
  { name: 'Miscellaneous', code: 'MISC', description: 'Miscellaneous school charges' },
] as const;

const feeItemsData = [
  { code: 'TUITION', name: 'Tuition Fee', amountCentavos: 50_000_00 },
  { code: 'LAB', name: 'Laboratory Fee', amountCentavos: 10_000_00 },
  { code: 'ACTIVITY', name: 'Activity Fee', amountCentavos: 5_000_00 },
  { code: 'MISC', name: 'Miscellaneous Fee', amountCentavos: 5_000_00 },
] as const;

type SeedUser = (typeof schema.users)['$inferSelect'];
type SeedStudent = (typeof schema.students)['$inferSelect'] & { gradeCode: string };
type SeedGuardian = (typeof schema.guardians)['$inferSelect'];
type SeedStructure = (typeof schema.feeStructures)['$inferSelect'];
type SeedStructureItem = (typeof schema.feeStructureItems)['$inferSelect'];
type SeedAssessment = (typeof schema.studentAssessments)['$inferSelect'];
type SeedPayment = (typeof schema.payments)['$inferSelect'];
type SeedReceipt = (typeof schema.receipts)['$inferSelect'];
type SeedNotificationType = (typeof schema.notifications)['$inferInsert']['type'];

function sumLedger(entries: Array<{ debitCentavos: number; creditCentavos: number }>) {
  return entries.reduce(
    (balance, entry) => balance + entry.debitCentavos - entry.creditCentavos,
    0
  );
}

async function ensureSchoolYear(db: DatabaseInstance) {
  const existing = await db
    .select()
    .from(schema.schoolYears)
    .where(eq(schema.schoolYears.name, DEMO_SCHOOL_YEAR_NAME))
    .limit(1);

  let schoolYear = existing[0];
  if (!schoolYear) {
    [schoolYear] = await db
      .insert(schema.schoolYears)
      .values({
        name: DEMO_SCHOOL_YEAR_NAME,
        startDate: new Date('2026-06-01T00:00:00+08:00'),
        endDate: new Date('2027-03-31T23:59:59+08:00'),
        status: 'DRAFT',
      })
      .returning();
  } else {
    [schoolYear] = await db
      .update(schema.schoolYears)
      .set({
        startDate: new Date('2026-06-01T00:00:00+08:00'),
        endDate: new Date('2027-03-31T23:59:59+08:00'),
      })
      .where(eq(schema.schoolYears.id, schoolYear.id))
      .returning();
  }

  if (!schoolYear) throw new Error('The deterministic demo school year could not be created.');

  // The schema permits only one ACTIVE school year. Repeated seed runs always
  // converge on the deterministic demo year rather than creating a second one.
  await db
    .update(schema.schoolYears)
    .set({ status: 'ARCHIVED' })
    .where(eq(schema.schoolYears.status, 'ACTIVE'));
  [schoolYear] = await db
    .update(schema.schoolYears)
    .set({ status: 'ACTIVE' })
    .where(eq(schema.schoolYears.id, schoolYear.id))
    .returning();

  return schoolYear;
}

async function ensureSettings(db: DatabaseInstance, activeSchoolYearId: string) {
  const existing = await db.select().from(schema.schoolSettings).limit(1);
  const values = {
    schoolName: 'Online School Fees Monitoring & Payment System',
    shortName: 'OSFS',
    address: '123 Education Way, Manila, Philippines',
    email: 'info@schoolfees.example.com',
    phone: '+63 (2) 8123-4567',
    receiptPrefix: 'OSFS',
    currencyCode: 'PHP',
    timezone: 'Asia/Manila',
    studentPortalEnabled: true,
    activeSchoolYearId,
  };

  if (existing[0]) {
    await db
      .update(schema.schoolSettings)
      .set(values)
      .where(eq(schema.schoolSettings.id, existing[0].id));
    return existing[0].id;
  }

  const [settings] = await db.insert(schema.schoolSettings).values(values).returning();
  if (!settings) throw new Error('The deterministic institution settings could not be created.');
  return settings.id;
}

async function ensureAcademicStructure(db: DatabaseInstance, schoolYearId: string) {
  const gradeMap = new Map<string, string>();
  for (const grade of gradesData) {
    const existing = await db
      .select()
      .from(schema.gradeLevels)
      .where(eq(schema.gradeLevels.code, grade.code))
      .limit(1);
    const row = existing[0]
      ? (
          await db
            .update(schema.gradeLevels)
            .set({ name: grade.name, displayOrder: grade.displayOrder })
            .where(eq(schema.gradeLevels.id, existing[0].id))
            .returning()
        )[0]
      : (await db.insert(schema.gradeLevels).values(grade).returning())[0];
    if (!row) throw new Error(`Grade ${grade.code} could not be seeded.`);
    gradeMap.set(grade.code, row.id);
  }

  const sectionMap = new Map<string, string>();
  for (const grade of gradesData) {
    const gradeLevelId = gradeMap.get(grade.code);
    if (!gradeLevelId) throw new Error(`Grade ${grade.code} is missing after seeding.`);

    for (const suffix of ['A', 'B'] as const) {
      const code = `${grade.code}-${suffix}`;
      const existing = await db
        .select()
        .from(schema.sections)
        .where(and(eq(schema.sections.schoolYearId, schoolYearId), eq(schema.sections.code, code)))
        .limit(1);
      const row = existing[0]
        ? (
            await db
              .update(schema.sections)
              .set({ gradeLevelId, name: `Section ${suffix}` })
              .where(eq(schema.sections.id, existing[0].id))
              .returning()
          )[0]
        : (
            await db
              .insert(schema.sections)
              .values({
                gradeLevelId,
                schoolYearId,
                name: `Section ${suffix}`,
                code,
              })
              .returning()
          )[0];
      if (!row) throw new Error(`Section ${code} could not be seeded.`);
      sectionMap.set(code, row.id);
    }
  }

  return { gradeMap, sectionMap };
}

async function ensureDemoUsers(db: DatabaseInstance) {
  const demoUsers = [
    { name: 'System Administrator', email: 'admin@demo.school', role: 'ADMIN' },
    { name: 'Finance Staff', email: 'finance@demo.school', role: 'FINANCE_STAFF' },
    { name: 'Demo Parent', email: 'parent@demo.school', role: 'PARENT' },
    { name: 'Demo Student', email: 'student@demo.school', role: 'STUDENT' },
  ] as const;

  // This seed-only auth instance uses Better Auth's own password hashing and
  // sign-up utilities. Public sign-up remains disabled in the application auth.
  const seedAuth = createAuth({ allowSignUp: true, database: db });
  const authContext = await seedAuth.$context;
  const users = new Map<string, SeedUser>();

  for (const demoUser of demoUsers) {
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, demoUser.email))
      .limit(1);

    let user = existing[0];
    if (!user) {
      const result = await seedAuth.api.signUpEmail({
        body: {
          name: demoUser.name,
          email: demoUser.email,
          password: DEMO_PASSWORD,
          rememberMe: false,
        },
      });
      user = result.user as SeedUser;
    } else {
      const passwordHash = await authContext.password.hash(DEMO_PASSWORD);
      const credentialAccounts = await db
        .select({ id: schema.accounts.id })
        .from(schema.accounts)
        .where(
          and(eq(schema.accounts.userId, user.id), eq(schema.accounts.providerId, 'credential'))
        )
        .limit(1);

      if (credentialAccounts.length === 0) {
        await authContext.internalAdapter.linkAccount({
          userId: user.id,
          providerId: 'credential',
          accountId: user.id,
          password: passwordHash,
        });
      } else {
        await db
          .update(schema.accounts)
          .set({ password: passwordHash, updatedAt: DEMO_NOW })
          .where(eq(schema.accounts.id, credentialAccounts[0].id));
      }
    }

    const [updated] = await db
      .update(schema.users)
      .set({
        name: demoUser.name,
        role: demoUser.role,
        active: true,
        emailVerified: true,
        updatedAt: DEMO_NOW,
      })
      .where(eq(schema.users.id, user.id))
      .returning();
    if (!updated) throw new Error(`Demo account ${demoUser.email} could not be updated.`);
    users.set(demoUser.email, updated);
  }

  return users;
}

async function ensureStudents(
  db: DatabaseInstance,
  schoolYearId: string,
  gradeMap: Map<string, string>,
  sectionMap: Map<string, string>,
  studentUserId: string
) {
  await db
    .update(schema.students)
    .set({ userId: null })
    .where(eq(schema.students.userId, studentUserId));

  const firstNames = [
    'Alex',
    'Bianca',
    'Carlo',
    'Diana',
    'Ethan',
    'Faith',
    'Gabriel',
    'Hannah',
    'Ivan',
    'Julia',
  ];
  const lastNames = [
    'Santos',
    'Reyes',
    'Cruz',
    'Garcia',
    'Mendoza',
    'Navarro',
    'Bautista',
    'Ramos',
    'Villanueva',
    'Dela Cruz',
  ];
  const students: SeedStudent[] = [];

  for (let index = 0; index < DEMO_STUDENT_COUNT; index += 1) {
    const number = index + 1;
    const grade = gradesData[index % gradesData.length];
    const studentNumber = `DEMO-${String(number).padStart(4, '0')}`;
    const existing = await db
      .select()
      .from(schema.students)
      .where(eq(schema.students.studentNumber, studentNumber))
      .limit(1);
    const values = {
      studentNumber,
      firstName: firstNames[index % firstNames.length],
      lastName: lastNames[index % lastNames.length],
      email:
        number === 1
          ? 'student@demo.school'
          : `student${String(number).padStart(2, '0')}@demo.school`,
      userId: number === 1 ? studentUserId : null,
      gradeLevelId: gradeMap.get(grade.code) ?? null,
      sectionId: sectionMap.get(`${grade.code}-${number % 2 === 0 ? 'B' : 'A'}`) ?? null,
      schoolYearId,
      status: number === 12 ? ('WITHDRAWN' as const) : ('ACTIVE' as const),
      updatedAt: DEMO_NOW,
    };
    const row = existing[0]
      ? (
          await db
            .update(schema.students)
            .set(values)
            .where(eq(schema.students.id, existing[0].id))
            .returning()
        )[0]
      : (await db.insert(schema.students).values(values).returning())[0];
    if (!row) throw new Error(`Student ${studentNumber} could not be seeded.`);
    students.push({ ...row, gradeCode: grade.code });
  }

  return students;
}

async function ensureGuardians(db: DatabaseInstance, parentUserId: string) {
  await db
    .update(schema.guardians)
    .set({ userId: null })
    .where(eq(schema.guardians.userId, parentUserId));

  const guardians: SeedGuardian[] = [];
  for (let index = 0; index < DEMO_GUARDIAN_COUNT; index += 1) {
    const number = index + 1;
    const email =
      number === 1
        ? 'parent@demo.school'
        : `guardian${String(number).padStart(2, '0')}@demo.school`;
    const existing = await db
      .select()
      .from(schema.guardians)
      .where(eq(schema.guardians.email, email))
      .limit(1);
    const values = {
      firstName: 'Demo',
      lastName: `Guardian ${String(number).padStart(2, '0')}`,
      email,
      phone: `+63 917 555 ${String(1000 + number)}`,
      relationship: number === 1 ? 'Parent' : 'Guardian',
      address: '123 Education Way, Manila, Philippines',
      userId: number === 1 ? parentUserId : null,
      updatedAt: DEMO_NOW,
    };
    const row = existing[0]
      ? (
          await db
            .update(schema.guardians)
            .set(values)
            .where(eq(schema.guardians.id, existing[0].id))
            .returning()
        )[0]
      : (await db.insert(schema.guardians).values(values).returning())[0];
    if (!row) throw new Error(`Guardian ${email} could not be seeded.`);
    guardians.push(row);
  }

  return guardians;
}

async function ensureGuardianLinks(
  db: DatabaseInstance,
  guardians: SeedGuardian[],
  students: SeedStudent[]
) {
  for (let index = 0; index < guardians.length; index += 1) {
    const guardian = guardians[index];
    const linkedStudents = students.slice(index * 2, index * 2 + 2);
    for (const [studentIndex, student] of linkedStudents.entries()) {
      const existing = await db
        .select({ id: schema.guardianStudents.id })
        .from(schema.guardianStudents)
        .where(
          and(
            eq(schema.guardianStudents.guardianId, guardian.id),
            eq(schema.guardianStudents.studentId, student.id)
          )
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(schema.guardianStudents).values({
          guardianId: guardian.id,
          studentId: student.id,
          isPrimary: studentIndex === 0,
        });
      }
    }
  }
}

async function ensureFeeStructures(
  db: DatabaseInstance,
  schoolYearId: string,
  gradeMap: Map<string, string>
) {
  const structures = new Map<string, { structure: SeedStructure; items: SeedStructureItem[] }>();
  const categoryMap = new Map<string, string>();

  for (const category of feeCategoriesData) {
    const existing = await db
      .select()
      .from(schema.feeCategories)
      .where(eq(schema.feeCategories.code, category.code))
      .limit(1);
    const row = existing[0]
      ? (
          await db
            .update(schema.feeCategories)
            .set({
              name: category.name,
              description: category.description,
              status: 'ACTIVE',
            })
            .where(eq(schema.feeCategories.id, existing[0].id))
            .returning()
        )[0]
      : (
          await db
            .insert(schema.feeCategories)
            .values({ ...category, status: 'ACTIVE' })
            .returning()
        )[0];
    if (!row) throw new Error(`Fee category ${category.code} could not be seeded.`);
    categoryMap.set(category.code, row.id);
  }

  for (const grade of gradesData) {
    const gradeLevelId = gradeMap.get(grade.code);
    if (!gradeLevelId) throw new Error(`Grade ${grade.code} is missing for fee structures.`);
    const name = `Demo ${grade.code} Annual Fee Structure`;
    const existing = await db
      .select()
      .from(schema.feeStructures)
      .where(
        and(
          eq(schema.feeStructures.schoolYearId, schoolYearId),
          eq(schema.feeStructures.gradeLevelId, gradeLevelId),
          eq(schema.feeStructures.assessmentPeriod, 'ANNUAL'),
          eq(schema.feeStructures.name, name)
        )
      )
      .limit(1);
    const structure = existing[0]
      ? (
          await db
            .update(schema.feeStructures)
            .set({ status: 'ACTIVE', updatedAt: DEMO_NOW })
            .where(eq(schema.feeStructures.id, existing[0].id))
            .returning()
        )[0]
      : (
          await db
            .insert(schema.feeStructures)
            .values({
              schoolYearId,
              gradeLevelId,
              assessmentPeriod: 'ANNUAL',
              name,
              status: 'ACTIVE',
            })
            .returning()
        )[0];
    if (!structure) throw new Error(`Fee structure ${name} could not be seeded.`);

    const items: SeedStructureItem[] = [];
    for (const item of feeItemsData) {
      const feeCategoryId = categoryMap.get(item.code);
      if (!feeCategoryId) throw new Error(`Fee category ${item.code} is missing.`);
      const existingItem = await db
        .select()
        .from(schema.feeStructureItems)
        .where(
          and(
            eq(schema.feeStructureItems.feeStructureId, structure.id),
            eq(schema.feeStructureItems.feeCategoryId, feeCategoryId)
          )
        )
        .limit(1);
      const row = existingItem[0]
        ? (
            await db
              .update(schema.feeStructureItems)
              .set({ name: item.name, amountCentavos: item.amountCentavos })
              .where(eq(schema.feeStructureItems.id, existingItem[0].id))
              .returning()
          )[0]
        : (
            await db
              .insert(schema.feeStructureItems)
              .values({
                feeStructureId: structure.id,
                feeCategoryId,
                name: item.name,
                amountCentavos: item.amountCentavos,
              })
              .returning()
          )[0];
      if (!row) throw new Error(`Fee item ${item.code} could not be seeded.`);
      items.push(row);
    }
    structures.set(grade.code, { structure, items });
  }

  return structures;
}

async function notificationRecipients(db: DatabaseInstance, studentId: string) {
  const student = await db
    .select({ userId: schema.students.userId })
    .from(schema.students)
    .where(eq(schema.students.id, studentId))
    .limit(1);
  const guardians = await db
    .select({ userId: schema.guardians.userId })
    .from(schema.guardianStudents)
    .innerJoin(schema.guardians, eq(schema.guardians.id, schema.guardianStudents.guardianId))
    .where(eq(schema.guardianStudents.studentId, studentId));
  return [student[0]?.userId, ...guardians.map((row) => row.userId)].filter(
    (userId): userId is string => Boolean(userId)
  );
}

async function ensureSeedNotifications(
  db: DatabaseInstance,
  studentId: string,
  type: SeedNotificationType,
  entityType: string,
  entityId: string,
  title: string,
  body: string
) {
  const recipients = [...new Set(await notificationRecipients(db, studentId))];
  for (const userId of recipients) {
    const dedupeKey = `seed:${type}:${entityId}:${userId}`;
    const existing = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(eq(schema.notifications.dedupeKey, dedupeKey))
      .limit(1);
    if (existing[0]) continue;

    const [notification] = await db
      .insert(schema.notifications)
      .values({
        userId,
        type,
        dedupeKey,
        entityType,
        entityId,
        title,
        body,
        createdAt: DEMO_NOW,
      })
      .returning();
    if (!notification) throw new Error(`Notification ${dedupeKey} could not be seeded.`);

    await db.insert(schema.notificationDeliveries).values({
      notificationId: notification.id,
      channel: 'CONSOLE',
      status: 'SENT',
      attemptCount: 1,
      providerMessageId: `seed-console-${notification.id}`,
      lastAttemptAt: DEMO_NOW,
      sentAt: DEMO_NOW,
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    });
  }
}

async function ensureAssessment(
  db: DatabaseInstance,
  student: SeedStudent,
  schoolYearId: string,
  structure: SeedStructure,
  items: SeedStructureItem[],
  adminUserId: string
) {
  const existing = await db
    .select()
    .from(schema.studentAssessments)
    .where(
      and(
        eq(schema.studentAssessments.studentId, student.id),
        eq(schema.studentAssessments.schoolYearId, schoolYearId),
        eq(schema.studentAssessments.assessmentPeriod, 'ANNUAL')
      )
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const totalAmountCentavos = items.reduce((total, item) => total + item.amountCentavos, 0);
  const [assessment] = await db
    .insert(schema.studentAssessments)
    .values({
      studentId: student.id,
      schoolYearId,
      feeStructureId: structure.id,
      assessmentPeriod: 'ANNUAL',
      totalAmountCentavos,
      status: 'POSTED',
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    })
    .returning();
  if (!assessment) throw new Error(`Assessment for ${student.studentNumber} could not be seeded.`);

  await db.insert(schema.assessmentItems).values(
    items.map((item) => ({
      assessmentId: assessment.id,
      feeCategoryId: item.feeCategoryId,
      name: item.name,
      amountCentavos: item.amountCentavos,
      createdAt: DEMO_NOW,
    }))
  );
  await db.insert(schema.ledgerEntries).values({
    studentId: student.id,
    assessmentId: assessment.id,
    entryType: 'ASSESSMENT',
    debitCentavos: totalAmountCentavos,
    creditCentavos: 0,
    balanceCentavos: totalAmountCentavos,
    description: `Demo assessment posted from ${structure.name}`,
    createdAt: DEMO_NOW,
  });
  await db.insert(schema.auditLogs).values({
    userId: adminUserId,
    action: 'ASSESSMENT_POSTED',
    entityType: 'ASSESSMENT',
    entityId: assessment.id,
    details: JSON.stringify({
      seed: true,
      studentNumber: student.studentNumber,
      totalAmountCentavos,
    }),
    createdAt: DEMO_NOW,
  });
  await ensureSeedNotifications(
    db,
    student.id,
    'ASSESSMENT_POSTED',
    'ASSESSMENT',
    assessment.id,
    'Assessment posted',
    `The demo assessment for ${student.studentNumber} is ready for review.`
  );
  return assessment;
}

async function ensurePayment(
  db: DatabaseInstance,
  student: SeedStudent,
  assessment: SeedAssessment,
  amountCentavos: number,
  paymentMethod: 'CASH' | 'BANK_DEPOSIT' | 'MOCK_ONLINE',
  referenceNumber: string,
  idempotencyKey: string,
  financeUserId: string
) {
  const existing = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing[0]) {
    const receipts = await db
      .select()
      .from(schema.receipts)
      .where(eq(schema.receipts.paymentId, existing[0].id))
      .limit(1);
    return { payment: existing[0], receipt: receipts[0] };
  }

  const ledgerRows = await db
    .select({
      debitCentavos: schema.ledgerEntries.debitCentavos,
      creditCentavos: schema.ledgerEntries.creditCentavos,
    })
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.studentId, student.id));
  const currentBalance = sumLedger(ledgerRows);
  if (amountCentavos <= 0 || amountCentavos > currentBalance) {
    throw new Error(`Seed payment for ${student.studentNumber} exceeds the current balance.`);
  }

  const assessmentItems = await db
    .select()
    .from(schema.assessmentItems)
    .where(eq(schema.assessmentItems.assessmentId, assessment.id));
  let remaining = amountCentavos;
  const allocations: Array<{ assessmentItemId: string; amountCentavos: number }> = [];
  for (const item of assessmentItems) {
    if (remaining === 0) break;
    const prior = await db
      .select({ amountCentavos: schema.paymentAllocations.amountCentavos })
      .from(schema.paymentAllocations)
      .where(eq(schema.paymentAllocations.assessmentItemId, item.id));
    const alreadyAllocated = prior.reduce((total, row) => total + row.amountCentavos, 0);
    const available = Math.max(0, item.amountCentavos - alreadyAllocated);
    const allocationAmount = Math.min(remaining, available);
    if (allocationAmount > 0) {
      allocations.push({ assessmentItemId: item.id, amountCentavos: allocationAmount });
      remaining -= allocationAmount;
    }
  }
  if (remaining !== 0)
    throw new Error(`Seed payment for ${student.studentNumber} could not be allocated.`);

  const [payment] = await db
    .insert(schema.payments)
    .values({
      studentId: student.id,
      assessmentId: assessment.id,
      amountCentavos,
      paymentMethod,
      referenceNumber,
      idempotencyKey,
      status: 'POSTED',
      processedByUserId: financeUserId,
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    })
    .returning();
  if (!payment) throw new Error(`Payment for ${student.studentNumber} could not be seeded.`);

  await db.insert(schema.paymentAllocations).values(
    allocations.map((allocation) => ({
      ...allocation,
      paymentId: payment.id,
      createdAt: DEMO_NOW,
    }))
  );
  await db.insert(schema.ledgerEntries).values({
    studentId: student.id,
    assessmentId: assessment.id,
    entryType: 'PAYMENT',
    debitCentavos: 0,
    creditCentavos: amountCentavos,
    balanceCentavos: currentBalance - amountCentavos,
    description: `Demo ${paymentMethod} payment ${referenceNumber}`,
    createdAt: DEMO_NOW,
  });

  const [settings, gradeRows, sectionRows, processorRows] = await Promise.all([
    db.select().from(schema.schoolSettings).limit(1),
    db
      .select({ name: schema.gradeLevels.name })
      .from(schema.gradeLevels)
      .where(eq(schema.gradeLevels.id, student.gradeLevelId!))
      .limit(1),
    db
      .select({ name: schema.sections.name })
      .from(schema.sections)
      .where(eq(schema.sections.id, student.sectionId!))
      .limit(1),
    db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, financeUserId))
      .limit(1),
  ]);
  const institution = settings[0];
  const receiptNumber = `OSFS-DEMO-${student.studentNumber}`;
  const verificationIdentifier = `VER-DEMO-${student.studentNumber}`;
  const receiptSnapshot = receiptSnapshotSchema.parse({
    version: 1,
    issuedAt: DEMO_NOW.toISOString(),
    receiptNumber,
    verificationIdentifier,
    institution: {
      name: institution?.schoolName ?? 'Online School Fees Monitoring & Payment System',
      address: institution?.address ?? 'Fictional capstone demonstration',
      email: institution?.email ?? 'info@schoolfees.example.com',
      phone: institution?.phone ?? '+63 (2) 8123-4567',
      timezone: institution?.timezone ?? 'Asia/Manila',
    },
    student: {
      studentNumber: student.studentNumber,
      name: `${student.firstName} ${student.lastName}`,
      gradeAndSection: [gradeRows[0]?.name ?? student.gradeCode, sectionRows[0]?.name]
        .filter(Boolean)
        .join(' - '),
    },
    payment: {
      amountCentavos,
      paymentMethod,
      referenceNumber,
      balanceAfterPaymentCentavos: currentBalance - amountCentavos,
    },
    processor: {
      name: getReceiptProcessorName(paymentMethod, processorRows[0]?.name),
    },
    allocations: allocations.map((allocation) => ({
      targetType: 'ASSESSMENT_ITEM' as const,
      name:
        assessmentItems.find((item) => item.id === allocation.assessmentItemId)?.name ??
        'Assessment item',
      amountCentavos: allocation.amountCentavos,
    })),
  });

  const [receipt] = await db
    .insert(schema.receipts)
    .values({
      paymentId: payment.id,
      receiptNumber,
      verificationIdentifier,
      status: 'ACTIVE',
      issuanceSnapshot: receiptSnapshot,
      createdAt: DEMO_NOW,
    })
    .returning();
  if (!receipt) throw new Error(`Receipt for ${student.studentNumber} could not be seeded.`);

  await db.insert(schema.auditLogs).values([
    {
      userId: financeUserId,
      action: 'PAYMENT_POSTED',
      entityType: 'PAYMENT',
      entityId: payment.id,
      details: JSON.stringify({ seed: true, amountCentavos, paymentMethod }),
      createdAt: DEMO_NOW,
    },
    {
      userId: financeUserId,
      action: 'RECEIPT_ISSUED',
      entityType: 'RECEIPT',
      entityId: receipt.id,
      details: JSON.stringify({ seed: true, paymentId: payment.id }),
      createdAt: DEMO_NOW,
    },
  ]);
  await ensureSeedNotifications(
    db,
    student.id,
    'PAYMENT_SUCCESSFUL',
    'PAYMENT',
    payment.id,
    'Payment received',
    `A demo ${paymentMethod.toLowerCase()} payment was posted for ${student.studentNumber}.`
  );
  await ensureSeedNotifications(
    db,
    student.id,
    'RECEIPT_AVAILABLE',
    'RECEIPT',
    receipt.id,
    'Receipt available',
    `Payment acknowledgment receipt ${receipt.receiptNumber} is available.`
  );
  return { payment, receipt };
}

async function ensureReversal(
  db: DatabaseInstance,
  student: SeedStudent,
  payment: SeedPayment,
  receipt: SeedReceipt,
  financeUserId: string
) {
  if (payment.status === 'REVERSED') return;
  const ledgerRows = await db
    .select({
      debitCentavos: schema.ledgerEntries.debitCentavos,
      creditCentavos: schema.ledgerEntries.creditCentavos,
    })
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.studentId, student.id));
  const [reversal] = await db
    .insert(schema.paymentReversals)
    .values({
      paymentId: payment.id,
      receiptId: receipt.id,
      reason: 'Demo reversal for audit walkthrough',
      reversedByUserId: financeUserId,
      createdAt: DEMO_NOW,
    })
    .returning();
  if (!reversal) throw new Error(`Reversal for ${student.studentNumber} could not be seeded.`);
  await db
    .update(schema.payments)
    .set({ status: 'REVERSED', updatedAt: DEMO_NOW })
    .where(eq(schema.payments.id, payment.id));
  await db
    .update(schema.receipts)
    .set({ status: 'VOIDED' })
    .where(eq(schema.receipts.id, receipt.id));
  await db.insert(schema.ledgerEntries).values({
    studentId: student.id,
    assessmentId: payment.assessmentId,
    entryType: 'REVERSAL',
    debitCentavos: payment.amountCentavos,
    creditCentavos: 0,
    balanceCentavos: sumLedger(ledgerRows) + payment.amountCentavos,
    description: `Demo reversal for payment ${payment.id}`,
    createdAt: DEMO_NOW,
  });
  await db.insert(schema.auditLogs).values({
    userId: financeUserId,
    action: 'PAYMENT_REVERSED',
    entityType: 'PAYMENT',
    entityId: payment.id,
    details: JSON.stringify({ seed: true, reversalId: reversal.id }),
    createdAt: DEMO_NOW,
  });
  await ensureSeedNotifications(
    db,
    student.id,
    'PAYMENT_REVERSED',
    'PAYMENT',
    payment.id,
    'Payment reversed',
    `The demo payment for ${student.studentNumber} was reversed and its receipt was voided.`
  );
}

async function ensureCheckout(
  db: DatabaseInstance,
  input: {
    student: SeedStudent;
    assessment: SeedAssessment;
    paymentId?: string;
    reference: string;
    idempotencyKey: string;
    eventId: string;
    callbackIdempotencyKey: string;
    status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  }
) {
  const existing = await db
    .select()
    .from(schema.mockPaymentCheckouts)
    .where(eq(schema.mockPaymentCheckouts.idempotencyKey, input.idempotencyKey))
    .limit(1);
  const checkout = existing[0]
    ? existing[0]
    : (
        await db
          .insert(schema.mockPaymentCheckouts)
          .values({
            checkoutReference: input.reference,
            idempotencyKey: input.idempotencyKey,
            studentId: input.student.id,
            assessmentId: input.assessment.id,
            paymentId: input.paymentId ?? null,
            paymentChannel: 'GCash',
            amountCentavos: input.status === 'SUCCEEDED' ? 7_000_00 : 1_000_00,
            status: input.status,
            expiresAt: DEMO_EXPIRY,
            completedAt: input.status === 'SUCCEEDED' ? DEMO_NOW : null,
            createdAt: DEMO_NOW,
            updatedAt: DEMO_NOW,
          })
          .returning()
      )[0];
  if (!checkout) throw new Error(`Checkout ${input.reference} could not be seeded.`);

  const callback = await db
    .select({ id: schema.mockPaymentCallbackEvents.id })
    .from(schema.mockPaymentCallbackEvents)
    .where(eq(schema.mockPaymentCallbackEvents.eventId, input.eventId))
    .limit(1);
  if (callback.length === 0) {
    await db.insert(schema.mockPaymentCallbackEvents).values({
      checkoutId: checkout.id,
      eventId: input.eventId,
      idempotencyKey: input.callbackIdempotencyKey,
      eventType:
        input.status === 'SUCCEEDED'
          ? 'PAYMENT_SUCCEEDED'
          : input.status === 'FAILED'
            ? 'PAYMENT_FAILED'
            : 'PAYMENT_CANCELLED',
      payload: {
        paymentReference: input.reference,
        status: input.status === 'SUCCEEDED' ? 'SUCCESS' : input.status,
        seed: true,
      },
      processingStatus: 'PROCESSED',
      receivedAt: DEMO_NOW,
      processedAt: DEMO_NOW,
    });
  }
  return checkout;
}

export async function seedDemoData(db: DatabaseInstance = getDb()) {
  console.log('🌱 Seeding deterministic fictional demo data...');
  const schoolYear = await ensureSchoolYear(db);
  await ensureSettings(db, schoolYear.id);
  const academic = await ensureAcademicStructure(db, schoolYear.id);
  const users = await ensureDemoUsers(db);
  const admin = users.get('admin@demo.school');
  const finance = users.get('finance@demo.school');
  const parent = users.get('parent@demo.school');
  const studentUser = users.get('student@demo.school');
  if (!admin || !finance || !parent || !studentUser) {
    throw new Error('The four deterministic demo accounts could not be resolved.');
  }

  const students = await ensureStudents(
    db,
    schoolYear.id,
    academic.gradeMap,
    academic.sectionMap,
    studentUser.id
  );
  const guardians = await ensureGuardians(db, parent.id);
  await ensureGuardianLinks(db, guardians, students);
  const structures = await ensureFeeStructures(db, schoolYear.id, academic.gradeMap);

  const assessments = new Map<string, SeedAssessment>();
  for (const student of students) {
    const structure = structures.get(student.gradeCode);
    if (!structure) throw new Error(`No fee structure exists for ${student.gradeCode}.`);
    const assessment = await ensureAssessment(
      db,
      student,
      schoolYear.id,
      structure.structure,
      structure.items,
      admin.id
    );
    assessments.set(student.studentNumber, assessment);
  }

  const assessmentFor = (studentNumber: string) => {
    const assessment = assessments.get(studentNumber);
    if (!assessment) throw new Error(`No seeded assessment exists for ${studentNumber}.`);
    return assessment;
  };
  const studentFor = (studentNumber: string) => {
    const student = students.find((row) => row.studentNumber === studentNumber);
    if (!student) throw new Error(`No seeded student exists for ${studentNumber}.`);
    return student;
  };

  await ensurePayment(
    db,
    studentFor('DEMO-0002'),
    assessmentFor('DEMO-0002'),
    20_000_00,
    'CASH',
    'DEMO-CASH-0002',
    'seed-payment-demo-0002',
    finance.id
  );
  await ensurePayment(
    db,
    studentFor('DEMO-0003'),
    assessmentFor('DEMO-0003'),
    70_000_00,
    'BANK_DEPOSIT',
    'DEMO-BANK-0003',
    'seed-payment-demo-0003',
    finance.id
  );
  const onlinePayment = await ensurePayment(
    db,
    studentFor('DEMO-0004'),
    assessmentFor('DEMO-0004'),
    70_000_00,
    'MOCK_ONLINE',
    'MOCK-DEMO-0004',
    'seed-payment-demo-0004',
    finance.id
  );
  await ensureCheckout(db, {
    student: studentFor('DEMO-0004'),
    assessment: assessmentFor('DEMO-0004'),
    paymentId: onlinePayment.payment.id,
    reference: 'MOCK-DEMO-0004',
    idempotencyKey: 'seed-checkout-demo-0004',
    eventId: 'seed-event-demo-0004',
    callbackIdempotencyKey: 'seed-callback-demo-0004',
    status: 'SUCCEEDED',
  });

  const reversedPayment = await ensurePayment(
    db,
    studentFor('DEMO-0005'),
    assessmentFor('DEMO-0005'),
    15_000_00,
    'CASH',
    'DEMO-REVERSAL-0005',
    'seed-payment-demo-0005',
    finance.id
  );
  if (!reversedPayment.receipt) throw new Error('The reversal fixture is missing its receipt.');
  await ensureReversal(
    db,
    studentFor('DEMO-0005'),
    reversedPayment.payment,
    reversedPayment.receipt,
    finance.id
  );

  await ensureCheckout(db, {
    student: studentFor('DEMO-0006'),
    assessment: assessmentFor('DEMO-0006'),
    reference: 'MOCK-DEMO-0006',
    idempotencyKey: 'seed-checkout-demo-0006',
    eventId: 'seed-event-demo-0006',
    callbackIdempotencyKey: 'seed-callback-demo-0006',
    status: 'FAILED',
  });
  await ensureCheckout(db, {
    student: studentFor('DEMO-0007'),
    assessment: assessmentFor('DEMO-0007'),
    reference: 'MOCK-DEMO-0007',
    idempotencyKey: 'seed-checkout-demo-0007',
    eventId: 'seed-event-demo-0007',
    callbackIdempotencyKey: 'seed-callback-demo-0007',
    status: 'CANCELLED',
  });

  console.log(
    `✅ Demo seed ready: 1 active school year, ${students.length} students, ${guardians.length} guardians, ${assessments.size} assessments, and persisted payment/receipt/audit/notification fixtures.`
  );
}

if (process.argv[1]?.includes('seed.ts')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logSanitizedError('database.seed', error);
      process.exit(1);
    });
}
