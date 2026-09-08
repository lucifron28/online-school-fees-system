import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import dotenv from 'dotenv';
import path from 'path';
import { createAuth } from '../../lib/auth/server';
import { getReceiptProcessorName, receiptSnapshotSchema } from '../../lib/receipt-snapshot';
import { normalizePaymentReference } from '../../lib/payment-submissions';
import { formatCentavos } from '../../lib/utils/currency';
import { getDb, type DatabaseInstance } from '../index';
import * as schema from '../schema';
import { logSanitizedError } from '../../server/logging';
import { calculateAssessmentDueDate } from '../../lib/deadlines';
import { allocateReceiptNumber, getReceiptYear } from '../../server/services/receipt.service';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Seeding is an explicit fictional demo fixture, so it opts into the mock-only records below.
process.env.ENABLE_MOCK_PAYMENT_HARNESS = 'true';

export const DEMO_PASSWORD = 'DemoPass123!';
export const DEMO_SCHOOL_YEAR_NAME = 'SY 2026–2027';
export const DEMO_STUDENT_COUNT = 20;
export const DEMO_GUARDIAN_COUNT = 10;

export const DEMO_NOW = new Date('2026-08-01T09:00:00+08:00');
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
    gcashEnabled: true,
    gcashAccountName: 'OSFS Demo GCash Account',
    gcashAccountNumber: '0999 000 0000',
    mayaEnabled: true,
    mayaAccountName: 'OSFS Demo Maya Account',
    mayaAccountNumber: '0998 000 0000',
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
        const account = credentialAccounts[0];
        if (account) {
          await db
            .update(schema.accounts)
            .set({ password: passwordHash, updatedAt: DEMO_NOW })
            .where(eq(schema.accounts.id, account.id));
        }
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
    const studentNumber = `DEMO-${String(number).padStart(4, '0')}`;
    const grade = gradesData[index % gradesData.length];
    if (!grade) throw new Error('Missing demo grade');
    const firstName = firstNames[index % firstNames.length] ?? 'Student';
    const lastName = lastNames[index % lastNames.length] ?? 'Demo';
    const existing = await db
      .select()
      .from(schema.students)
      .where(eq(schema.students.studentNumber, studentNumber))
      .limit(1);
    const values = {
      studentNumber,
      firstName,
      lastName,
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
    const existingStudent = existing[0];
    const row = existingStudent
      ? (
          await db
            .update(schema.students)
            .set(values)
            .where(eq(schema.students.id, existingStudent.id))
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
    if (!guardian) continue;
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
    await ensureDeterministicNotification(db, {
      userId,
      type,
      dedupeKey: `seed:${type}:${entityId}:${userId}`,
      entityType,
      entityId,
      title,
      body,
    });
  }
}

async function ensureDeterministicNotification(
  db: DatabaseInstance,
  input: {
    userId: string;
    type: SeedNotificationType;
    dedupeKey: string;
    entityType: string;
    entityId: string;
    title: string;
    body: string;
  }
) {
  const existing = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(eq(schema.notifications.dedupeKey, input.dedupeKey))
    .limit(1);
  const notificationId = existing[0]?.id;

  let notification = notificationId
    ? (
        await db
          .update(schema.notifications)
          .set({
            userId: input.userId,
            type: input.type,
            entityType: input.entityType,
            entityId: input.entityId,
            title: input.title,
            body: input.body,
            createdAt: DEMO_NOW,
          })
          .where(eq(schema.notifications.id, notificationId))
          .returning()
      )[0]
    : undefined;

  if (!notification) {
    notification = (
      await db
        .insert(schema.notifications)
        .values({
          userId: input.userId,
          type: input.type,
          dedupeKey: input.dedupeKey,
          entityType: input.entityType,
          entityId: input.entityId,
          title: input.title,
          body: input.body,
          createdAt: DEMO_NOW,
        })
        .returning()
    )[0];
  }
  if (!notification) throw new Error(`Notification ${input.dedupeKey} could not be seeded.`);

  const existingDelivery = await db
    .select({ id: schema.notificationDeliveries.id })
    .from(schema.notificationDeliveries)
    .where(
      and(
        eq(schema.notificationDeliveries.notificationId, notification.id),
        eq(schema.notificationDeliveries.channel, 'CONSOLE')
      )
    )
    .limit(1);
  const providerMessageId = `seed-console-${notification.id}`;
  const deliveryId = existingDelivery[0]?.id;

  if (deliveryId) {
    await db
      .update(schema.notificationDeliveries)
      .set({
        status: 'SENT',
        attemptCount: 1,
        providerMessageId,
        claimedAt: null,
        leaseExpiresAt: null,
        lastAttemptAt: DEMO_NOW,
        nextAttemptAt: null,
        sentAt: DEMO_NOW,
        errorMessage: null,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      })
      .where(eq(schema.notificationDeliveries.id, deliveryId));
    await db
      .update(schema.notificationDeliveryAttempts)
      .set({
        status: 'SENT',
        providerMessageId,
        errorMessage: null,
        attemptedAt: DEMO_NOW,
        completedAt: DEMO_NOW,
      })
      .where(eq(schema.notificationDeliveryAttempts.deliveryId, deliveryId));
    return;
  }

  await db.insert(schema.notificationDeliveries).values({
    notificationId: notification.id,
    channel: 'CONSOLE',
    status: 'SENT',
    attemptCount: 1,
    providerMessageId,
    lastAttemptAt: DEMO_NOW,
    sentAt: DEMO_NOW,
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  });
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
      dueDate: calculateAssessmentDueDate(DEMO_NOW, 7),
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
    `System-generated payment receipt ${receipt.receiptNumber} is available.`
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

async function ensureDemoAnnouncements(db: DatabaseInstance, adminUserId: string) {
  const announcements = [
    {
      title: 'Demo: Payment verification hours',
      body: 'Finance staff review manual GCash and Maya proof submissions during school office hours.',
    },
    {
      title: 'Demo: Keep your transfer reference',
      body: 'Include the complete transfer reference number and a clear screenshot when submitting payment proof.',
    },
    {
      title: 'Demo: School fees deadline reminder',
      body: 'Review each student account before the posted due date to keep the ledger current.',
    },
  ] as const;

  for (const announcement of announcements) {
    const existing = await db
      .select({ id: schema.announcements.id })
      .from(schema.announcements)
      .where(eq(schema.announcements.title, announcement.title))
      .limit(1);
    if (existing[0]) {
      await db
        .update(schema.announcements)
        .set({
          body: announcement.body,
          audience: 'PARENT_AND_STUDENT',
          status: 'PUBLISHED',
          publishAt: DEMO_NOW,
          expiresAt: DEMO_EXPIRY,
          updatedByUserId: adminUserId,
          updatedAt: DEMO_NOW,
        })
        .where(eq(schema.announcements.id, existing[0].id));
      continue;
    }
    await db.insert(schema.announcements).values({
      ...announcement,
      audience: 'PARENT_AND_STUDENT',
      status: 'PUBLISHED',
      publishAt: DEMO_NOW,
      expiresAt: DEMO_EXPIRY,
      createdByUserId: adminUserId,
      updatedByUserId: adminUserId,
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    });
  }
}

async function ensureDemoPaymentProofs(
  db: DatabaseInstance,
  parentUserId: string,
  financeUserId: string,
  students: SeedStudent[],
  assessments: Map<string, SeedAssessment>
) {
  const proof = {
    mimeType: 'image/png',
    originalFileName: 'demo-transfer-proof.png',
    data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    sizeBytes: 8,
    sha256: createHash('sha256')
      .update(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      .digest('hex'),
  };

  const studentFor = (studentNumber: string) => {
    const student = students.find((row) => row.studentNumber === studentNumber);
    if (!student) throw new Error(`No seeded student exists for ${studentNumber}.`);
    return student;
  };

  type ProofAllocation = {
    targetType: 'ASSESSMENT_ITEM' | 'DEBIT_ADJUSTMENT';
    name: string;
    amountCentavos: number;
  };

  const buildReceiptSnapshot = async (
    transactionDb: DatabaseInstance,
    student: SeedStudent,
    payment: SeedPayment,
    receiptNumber: string,
    verificationIdentifier: string,
    allocations: ProofAllocation[],
    balanceAfterPaymentCentavos: number
  ) => {
    const [settings, gradeRows, sectionRows, processorRows] = await Promise.all([
      transactionDb.select().from(schema.schoolSettings).limit(1),
      transactionDb
        .select({ name: schema.gradeLevels.name })
        .from(schema.gradeLevels)
        .where(eq(schema.gradeLevels.id, student.gradeLevelId!))
        .limit(1),
      transactionDb
        .select({ name: schema.sections.name })
        .from(schema.sections)
        .where(eq(schema.sections.id, student.sectionId!))
        .limit(1),
      transactionDb
        .select({ name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.id, financeUserId))
        .limit(1),
    ]);
    const institution = settings[0];
    return receiptSnapshotSchema.parse({
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
        amountCentavos: payment.amountCentavos,
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        balanceAfterPaymentCentavos,
      },
      processor: {
        name: getReceiptProcessorName(payment.paymentMethod, processorRows[0]?.name),
      },
      allocations,
    });
  };

  const ensureProofRecord = async (submissionId: string) => {
    const existing = await db
      .select({ id: schema.paymentSubmissionProofs.id })
      .from(schema.paymentSubmissionProofs)
      .where(eq(schema.paymentSubmissionProofs.submissionId, submissionId))
      .limit(1);
    if (existing[0]) {
      await db
        .update(schema.paymentSubmissionProofs)
        .set({
          mimeType: proof.mimeType,
          originalFileName: proof.originalFileName,
          sizeBytes: proof.sizeBytes,
          sha256: proof.sha256,
          data: proof.data,
          createdAt: DEMO_NOW,
        })
        .where(eq(schema.paymentSubmissionProofs.id, existing[0].id));
      return;
    }
    await db.insert(schema.paymentSubmissionProofs).values({
      submissionId,
      mimeType: proof.mimeType,
      originalFileName: proof.originalFileName,
      sizeBytes: proof.sizeBytes,
      sha256: proof.sha256,
      data: proof.data,
      createdAt: DEMO_NOW,
    });
  };

  const destinationFor = async (
    transactionDb: DatabaseInstance,
    paymentChannel: 'GCASH' | 'MAYA'
  ) => {
    const settings = await transactionDb.select().from(schema.schoolSettings).limit(1);
    const institution = settings[0];
    const destination =
      paymentChannel === 'GCASH'
        ? institution?.gcashEnabled &&
          institution.gcashAccountName &&
          institution.gcashAccountNumber
          ? {
              accountName: institution.gcashAccountName,
              accountNumber: institution.gcashAccountNumber,
            }
          : null
        : institution?.mayaEnabled && institution.mayaAccountName && institution.mayaAccountNumber
          ? {
              accountName: institution.mayaAccountName,
              accountNumber: institution.mayaAccountNumber,
            }
          : null;
    if (!destination) throw new Error(`${paymentChannel} proof submissions are not enabled.`);
    return destination;
  };

  const createApprovedSubmission = async (input: {
    student: SeedStudent;
    assessment: SeedAssessment;
    paymentChannel: 'GCASH' | 'MAYA';
    amountCentavos: number;
    referenceNumber: string;
    idempotencyKey: string;
  }) =>
    db.transaction(async (tx) => {
      const transactionDb = tx as unknown as DatabaseInstance;
      const destination = await destinationFor(transactionDb, input.paymentChannel);
      const ledgerRows = await tx
        .select({
          debitCentavos: schema.ledgerEntries.debitCentavos,
          creditCentavos: schema.ledgerEntries.creditCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, input.student.id));
      const currentBalance = sumLedger(ledgerRows);
      if (input.amountCentavos <= 0 || input.amountCentavos > currentBalance) {
        throw new Error(
          `Seed payment proof for ${input.student.studentNumber} exceeds the current balance.`
        );
      }

      const assessmentItems = await tx
        .select()
        .from(schema.assessmentItems)
        .where(eq(schema.assessmentItems.assessmentId, input.assessment.id));
      let remaining = input.amountCentavos;
      const allocations: Array<{
        assessmentItemId: string;
        name: string;
        amountCentavos: number;
      }> = [];
      for (const item of assessmentItems) {
        if (remaining === 0) break;
        const prior = await tx
          .select({ amountCentavos: schema.paymentAllocations.amountCentavos })
          .from(schema.paymentAllocations)
          .innerJoin(schema.payments, eq(schema.payments.id, schema.paymentAllocations.paymentId))
          .where(
            and(
              eq(schema.paymentAllocations.assessmentItemId, item.id),
              eq(schema.payments.status, 'POSTED')
            )
          );
        const alreadyAllocated = prior.reduce((total, row) => total + row.amountCentavos, 0);
        const available = Math.max(0, item.amountCentavos - alreadyAllocated);
        const allocationAmount = Math.min(remaining, available);
        if (allocationAmount > 0) {
          allocations.push({
            assessmentItemId: item.id,
            name: item.name,
            amountCentavos: allocationAmount,
          });
          remaining -= allocationAmount;
        }
      }
      if (remaining !== 0) {
        throw new Error(
          `Seed payment proof for ${input.student.studentNumber} could not be allocated.`
        );
      }

      const [payment] = await tx
        .insert(schema.payments)
        .values({
          studentId: input.student.id,
          assessmentId: input.assessment.id,
          amountCentavos: input.amountCentavos,
          paymentMethod: input.paymentChannel,
          referenceNumber: input.referenceNumber,
          idempotencyKey: `payment-submission:${input.idempotencyKey}`,
          status: 'POSTED',
          processedByUserId: financeUserId,
          createdAt: DEMO_NOW,
          updatedAt: DEMO_NOW,
        })
        .returning();
      if (!payment) throw new Error('The deterministic GCash payment could not be seeded.');

      await tx.insert(schema.paymentAllocations).values(
        allocations.map((allocation) => ({
          paymentId: payment.id,
          assessmentItemId: allocation.assessmentItemId,
          adjustmentId: null,
          amountCentavos: allocation.amountCentavos,
          createdAt: DEMO_NOW,
        }))
      );
      await tx.insert(schema.ledgerEntries).values({
        studentId: input.student.id,
        assessmentId: input.assessment.id,
        entryType: 'PAYMENT',
        debitCentavos: 0,
        creditCentavos: input.amountCentavos,
        balanceCentavos: currentBalance - input.amountCentavos,
        description: `Payment ${payment.id}`,
        createdAt: DEMO_NOW,
      });

      const sequence = await allocateReceiptNumber(tx, DEMO_NOW);
      await tx
        .update(schema.receiptNumberSequences)
        .set({ updatedAt: DEMO_NOW })
        .where(
          and(
            eq(schema.receiptNumberSequences.prefix, sequence.prefix),
            eq(schema.receiptNumberSequences.year, sequence.year)
          )
        );
      const verificationIdentifier = `VER-${payment.id}`;
      const receiptSnapshot = await buildReceiptSnapshot(
        transactionDb,
        input.student,
        payment,
        sequence.receiptNumber,
        verificationIdentifier,
        allocations.map((allocation) => ({
          targetType: 'ASSESSMENT_ITEM' as const,
          name: allocation.name,
          amountCentavos: allocation.amountCentavos,
        })),
        currentBalance - input.amountCentavos
      );
      const [receipt] = await tx
        .insert(schema.receipts)
        .values({
          paymentId: payment.id,
          receiptNumber: sequence.receiptNumber,
          verificationIdentifier,
          status: 'ACTIVE',
          issuanceSnapshot: receiptSnapshot,
          createdAt: DEMO_NOW,
        })
        .returning();
      if (!receipt) throw new Error('The deterministic payment receipt could not be seeded.');

      const [submission] = await tx
        .insert(schema.paymentSubmissions)
        .values({
          studentId: input.student.id,
          submittedByUserId: parentUserId,
          paymentChannel: input.paymentChannel,
          amountCentavos: input.amountCentavos,
          referenceNumber: input.referenceNumber,
          normalizedReferenceNumber: normalizePaymentReference(input.referenceNumber),
          destinationAccountName: destination.accountName,
          destinationAccountNumber: destination.accountNumber,
          paidAt: DEMO_NOW,
          status: 'APPROVED',
          reviewedByUserId: financeUserId,
          reviewedAt: DEMO_NOW,
          rejectionReason: null,
          approvedPaymentId: payment.id,
          idempotencyKey: input.idempotencyKey,
          createdAt: DEMO_NOW,
          updatedAt: DEMO_NOW,
        })
        .returning();
      if (!submission) throw new Error('The deterministic approved proof could not be seeded.');

      await tx.insert(schema.paymentSubmissionProofs).values({
        submissionId: submission.id,
        mimeType: proof.mimeType,
        originalFileName: proof.originalFileName,
        sizeBytes: proof.sizeBytes,
        sha256: proof.sha256,
        data: proof.data,
        createdAt: DEMO_NOW,
      });
      await tx.insert(schema.auditLogs).values([
        {
          userId: parentUserId,
          action: 'PAYMENT_PROOF_SUBMITTED',
          entityType: 'PAYMENT_SUBMISSION',
          entityId: submission.id,
          details: JSON.stringify({
            studentId: input.student.id,
            paymentChannel: input.paymentChannel,
            amountCentavos: input.amountCentavos,
            referenceNumber: input.referenceNumber,
            paidAt: DEMO_NOW.toISOString(),
            proofMimeType: proof.mimeType,
            proofSizeBytes: proof.sizeBytes,
            proofSha256: proof.sha256,
          }),
          createdAt: DEMO_NOW,
        },
        {
          userId: financeUserId,
          action: 'PAYMENT_PROOF_APPROVED',
          entityType: 'PAYMENT_SUBMISSION',
          entityId: submission.id,
          details: JSON.stringify({
            submissionId: submission.id,
            staffUserId: financeUserId,
            paymentId: payment.id,
            decision: 'APPROVED',
          }),
          createdAt: DEMO_NOW,
        },
        {
          userId: financeUserId,
          action: 'PAYMENT_POSTED',
          entityType: 'PAYMENT',
          entityId: payment.id,
          details: JSON.stringify({
            amountCentavos: input.amountCentavos,
            paymentMethod: input.paymentChannel,
            allocationCount: allocations.length,
            idempotencyKey: `payment-submission:${input.idempotencyKey}`,
          }),
          createdAt: DEMO_NOW,
        },
        {
          userId: financeUserId,
          action: 'RECEIPT_ISSUED',
          entityType: 'RECEIPT',
          entityId: receipt.id,
          details: JSON.stringify({ paymentId: payment.id, receiptNumber: sequence.receiptNumber }),
          createdAt: DEMO_NOW,
        },
      ]);

      return submission;
    });

  const createRejectedSubmission = async (input: {
    student: SeedStudent;
    paymentChannel: 'GCASH' | 'MAYA';
    amountCentavos: number;
    referenceNumber: string;
    idempotencyKey: string;
    rejectionReason: string;
  }) =>
    db.transaction(async (tx) => {
      const destination = await destinationFor(
        tx as unknown as DatabaseInstance,
        input.paymentChannel
      );
      const [submission] = await tx
        .insert(schema.paymentSubmissions)
        .values({
          studentId: input.student.id,
          submittedByUserId: parentUserId,
          paymentChannel: input.paymentChannel,
          amountCentavos: input.amountCentavos,
          referenceNumber: input.referenceNumber,
          normalizedReferenceNumber: normalizePaymentReference(input.referenceNumber),
          destinationAccountName: destination.accountName,
          destinationAccountNumber: destination.accountNumber,
          paidAt: DEMO_NOW,
          status: 'REJECTED',
          reviewedByUserId: financeUserId,
          reviewedAt: DEMO_NOW,
          rejectionReason: input.rejectionReason,
          approvedPaymentId: null,
          idempotencyKey: input.idempotencyKey,
          createdAt: DEMO_NOW,
          updatedAt: DEMO_NOW,
        })
        .returning();
      if (!submission) throw new Error('The deterministic rejected proof could not be seeded.');

      await tx.insert(schema.paymentSubmissionProofs).values({
        submissionId: submission.id,
        mimeType: proof.mimeType,
        originalFileName: proof.originalFileName,
        sizeBytes: proof.sizeBytes,
        sha256: proof.sha256,
        data: proof.data,
        createdAt: DEMO_NOW,
      });
      await tx.insert(schema.auditLogs).values([
        {
          userId: parentUserId,
          action: 'PAYMENT_PROOF_SUBMITTED',
          entityType: 'PAYMENT_SUBMISSION',
          entityId: submission.id,
          details: JSON.stringify({
            studentId: input.student.id,
            paymentChannel: input.paymentChannel,
            amountCentavos: input.amountCentavos,
            referenceNumber: input.referenceNumber,
            paidAt: DEMO_NOW.toISOString(),
            proofMimeType: proof.mimeType,
            proofSizeBytes: proof.sizeBytes,
            proofSha256: proof.sha256,
          }),
          createdAt: DEMO_NOW,
        },
        {
          userId: financeUserId,
          action: 'PAYMENT_PROOF_REJECTED',
          entityType: 'PAYMENT_SUBMISSION',
          entityId: submission.id,
          details: JSON.stringify({
            submissionId: submission.id,
            staffUserId: financeUserId,
            decision: 'REJECTED',
            reason: input.rejectionReason,
          }),
          createdAt: DEMO_NOW,
        },
      ]);
      return submission;
    });

  const reconcileApprovedSubmission = async (
    submission: typeof schema.paymentSubmissions.$inferSelect,
    student: SeedStudent
  ) => {
    if (!submission.approvedPaymentId) {
      throw new Error(`Approved demo proof ${submission.id} is missing its payment.`);
    }
    const payment = (
      await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, submission.approvedPaymentId))
        .limit(1)
    )[0];
    const receipt = (
      await db
        .select()
        .from(schema.receipts)
        .where(eq(schema.receipts.paymentId, submission.approvedPaymentId))
        .limit(1)
    )[0];
    if (!payment || !receipt) {
      throw new Error(`Approved demo proof ${submission.id} is missing its payment receipt.`);
    }

    const allocationRows = await db
      .select({
        assessmentItemId: schema.paymentAllocations.assessmentItemId,
        adjustmentId: schema.paymentAllocations.adjustmentId,
        amountCentavos: schema.paymentAllocations.amountCentavos,
        itemName: schema.assessmentItems.name,
        adjustmentReason: schema.adjustments.reason,
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
      .where(eq(schema.paymentAllocations.paymentId, payment.id));
    const ledgerRows = await db
      .select({
        debitCentavos: schema.ledgerEntries.debitCentavos,
        creditCentavos: schema.ledgerEntries.creditCentavos,
      })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.studentId, student.id));
    const balanceAfterPaymentCentavos = sumLedger(ledgerRows);
    const allocations: ProofAllocation[] = allocationRows.map((allocation) => ({
      targetType: allocation.adjustmentId ? 'DEBIT_ADJUSTMENT' : 'ASSESSMENT_ITEM',
      name: allocation.itemName ?? allocation.adjustmentReason ?? 'Debit adjustment',
      amountCentavos: allocation.amountCentavos,
    }));
    const settings = await db.select().from(schema.schoolSettings).limit(1);
    const timezone = settings[0]?.timezone ?? 'Asia/Manila';
    const expectedYear = getReceiptYear(DEMO_NOW, timezone);
    let receiptNumber = receipt.receiptNumber;
    if (!new RegExp(`-${expectedYear}-\\d{6}$`).test(receiptNumber)) {
      const sequence = await allocateReceiptNumber(db, DEMO_NOW);
      receiptNumber = sequence.receiptNumber;
      await db
        .update(schema.receiptNumberSequences)
        .set({ updatedAt: DEMO_NOW })
        .where(
          and(
            eq(schema.receiptNumberSequences.prefix, sequence.prefix),
            eq(schema.receiptNumberSequences.year, sequence.year)
          )
        );
    }
    const verificationIdentifier = `VER-${payment.id}`;
    const existingSnapshot = receiptSnapshotSchema.safeParse(receipt.issuanceSnapshot);
    const receiptSnapshot =
      existingSnapshot.success &&
      existingSnapshot.data.issuedAt === DEMO_NOW.toISOString() &&
      existingSnapshot.data.receiptNumber === receiptNumber &&
      existingSnapshot.data.verificationIdentifier === verificationIdentifier
        ? existingSnapshot.data
        : await buildReceiptSnapshot(
            db,
            student,
            payment,
            receiptNumber,
            verificationIdentifier,
            allocations,
            balanceAfterPaymentCentavos
          );

    await db
      .update(schema.payments)
      .set({ createdAt: DEMO_NOW, updatedAt: DEMO_NOW })
      .where(eq(schema.payments.id, payment.id));
    await db
      .update(schema.paymentAllocations)
      .set({ createdAt: DEMO_NOW })
      .where(eq(schema.paymentAllocations.paymentId, payment.id));
    await db
      .update(schema.ledgerEntries)
      .set({ createdAt: DEMO_NOW })
      .where(
        and(
          eq(schema.ledgerEntries.studentId, student.id),
          eq(schema.ledgerEntries.entryType, 'PAYMENT'),
          eq(schema.ledgerEntries.description, `Payment ${payment.id}`)
        )
      );
    await db
      .update(schema.receipts)
      .set({
        receiptNumber,
        verificationIdentifier,
        issuanceSnapshot: receiptSnapshot,
        createdAt: DEMO_NOW,
      })
      .where(eq(schema.receipts.id, receipt.id));
    await db
      .update(schema.paymentSubmissions)
      .set({
        status: 'APPROVED',
        paidAt: DEMO_NOW,
        reviewedByUserId: financeUserId,
        reviewedAt: DEMO_NOW,
        rejectionReason: null,
        approvedPaymentId: payment.id,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      })
      .where(eq(schema.paymentSubmissions.id, submission.id));
    await db
      .update(schema.auditLogs)
      .set({ createdAt: DEMO_NOW })
      .where(
        and(
          eq(schema.auditLogs.entityType, 'PAYMENT'),
          eq(schema.auditLogs.entityId, payment.id),
          eq(schema.auditLogs.action, 'PAYMENT_POSTED')
        )
      );
    await db
      .update(schema.auditLogs)
      .set({ createdAt: DEMO_NOW })
      .where(
        and(
          eq(schema.auditLogs.entityType, 'RECEIPT'),
          eq(schema.auditLogs.entityId, receipt.id),
          eq(schema.auditLogs.action, 'RECEIPT_ISSUED')
        )
      );
    await db
      .update(schema.auditLogs)
      .set({ createdAt: DEMO_NOW })
      .where(
        and(
          eq(schema.auditLogs.entityType, 'PAYMENT_SUBMISSION'),
          eq(schema.auditLogs.entityId, submission.id),
          inArray(schema.auditLogs.action, ['PAYMENT_PROOF_SUBMITTED', 'PAYMENT_PROOF_APPROVED'])
        )
      );
    const sequenceParts = /^(.+)-(\d{4})-\d{6}$/.exec(receiptNumber);
    if (sequenceParts?.[1] && sequenceParts[2]) {
      await db
        .update(schema.receiptNumberSequences)
        .set({ updatedAt: DEMO_NOW })
        .where(
          and(
            eq(schema.receiptNumberSequences.prefix, sequenceParts[1]),
            eq(schema.receiptNumberSequences.year, Number(sequenceParts[2]))
          )
        );
    }
  };

  const reconcileRejectedSubmission = async (
    submission: typeof schema.paymentSubmissions.$inferSelect,
    rejectionReason: string
  ) => {
    await db
      .update(schema.paymentSubmissions)
      .set({
        status: 'REJECTED',
        paidAt: DEMO_NOW,
        reviewedByUserId: financeUserId,
        reviewedAt: DEMO_NOW,
        rejectionReason,
        approvedPaymentId: null,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      })
      .where(eq(schema.paymentSubmissions.id, submission.id));
    await db
      .update(schema.auditLogs)
      .set({ createdAt: DEMO_NOW })
      .where(
        and(
          eq(schema.auditLogs.entityType, 'PAYMENT_SUBMISSION'),
          eq(schema.auditLogs.entityId, submission.id),
          inArray(schema.auditLogs.action, ['PAYMENT_PROOF_SUBMITTED', 'PAYMENT_PROOF_REJECTED'])
        )
      );
  };

  const ensureProofNotifications = async (input: {
    student: SeedStudent;
    submission: typeof schema.paymentSubmissions.$inferSelect;
    payment?: SeedPayment;
    receipt?: SeedReceipt;
    rejectionReason?: string;
  }) => {
    const studentName = `${input.student.firstName} ${input.student.lastName}`;
    await ensureDeterministicNotification(db, {
      userId: parentUserId,
      type: 'PAYMENT_PROOF_SUBMITTED',
      dedupeKey: `payment-proof-submitted:${input.submission.id}:${parentUserId}`,
      entityType: 'PAYMENT_SUBMISSION',
      entityId: input.submission.id,
      title: 'Payment proof submitted for review',
      body: `Your ${input.submission.paymentChannel} payment proof for ${studentName} (${formatCentavos(input.submission.amountCentavos)}) is pending school verification.`,
    });

    if (input.submission.status === 'REJECTED') {
      await ensureDeterministicNotification(db, {
        userId: parentUserId,
        type: 'PAYMENT_PROOF_REJECTED',
        dedupeKey: `payment-proof-rejected:${input.submission.id}:${parentUserId}`,
        entityType: 'PAYMENT_SUBMISSION',
        entityId: input.submission.id,
        title: 'Payment proof needs attention',
        body: `Your ${input.submission.paymentChannel} payment proof for ${studentName} was rejected. Reason: ${input.rejectionReason ?? input.submission.rejectionReason ?? 'The school requested a correction.'}`,
      });
      return;
    }

    if (!input.payment || !input.receipt) {
      throw new Error(
        `Approved demo proof ${input.submission.id} is missing notification records.`
      );
    }
    const recipients = [...new Set(await notificationRecipients(db, input.student.id))];
    for (const userId of recipients) {
      await ensureDeterministicNotification(db, {
        userId,
        type: 'PAYMENT_SUCCESSFUL',
        dedupeKey: `payment-successful:${input.payment.id}:${userId}`,
        entityType: 'PAYMENT',
        entityId: input.payment.id,
        title: `Payment received for ${studentName}`,
        body: `${formatCentavos(input.payment.amountCentavos)} was posted for ${studentName} through ${input.payment.paymentMethod}.`,
      });
      await ensureDeterministicNotification(db, {
        userId,
        type: 'RECEIPT_AVAILABLE',
        dedupeKey: `receipt-available:${input.receipt.id}:${userId}`,
        entityType: 'RECEIPT',
        entityId: input.receipt.id,
        title: 'System-generated payment receipt available',
        body: `System-generated payment receipt ${input.receipt.receiptNumber} is available for ${studentName}.`,
      });
    }
  };

  const ensureSubmission = async (input: {
    studentNumber: string;
    paymentChannel: 'GCASH' | 'MAYA';
    amountCentavos: number;
    referenceNumber: string;
    idempotencyKey: string;
    decision: 'APPROVE' | 'REJECT';
    rejectionReason?: string;
  }) => {
    const student = studentFor(input.studentNumber);
    const assessment = assessments.get(input.studentNumber);
    if (!assessment) {
      throw new Error(`No seeded assessment exists for ${input.studentNumber}.`);
    }
    const existing = await db
      .select()
      .from(schema.paymentSubmissions)
      .where(eq(schema.paymentSubmissions.idempotencyKey, input.idempotencyKey))
      .limit(1);
    let submission = existing[0];
    if (!submission) {
      submission =
        input.decision === 'APPROVE'
          ? await createApprovedSubmission({
              student,
              assessment,
              paymentChannel: input.paymentChannel,
              amountCentavos: input.amountCentavos,
              referenceNumber: input.referenceNumber,
              idempotencyKey: input.idempotencyKey,
            })
          : await createRejectedSubmission({
              student,
              paymentChannel: input.paymentChannel,
              amountCentavos: input.amountCentavos,
              referenceNumber: input.referenceNumber,
              idempotencyKey: input.idempotencyKey,
              rejectionReason: input.rejectionReason ?? 'Demo rejection.',
            });
    } else {
      if (
        submission.studentId !== student.id ||
        submission.paymentChannel !== input.paymentChannel ||
        submission.amountCentavos !== input.amountCentavos ||
        submission.referenceNumber !== input.referenceNumber
      ) {
        throw new Error(`Existing demo proof ${input.idempotencyKey} does not match its fixture.`);
      }
      await ensureProofRecord(submission.id);
      if (input.decision === 'APPROVE') {
        if (submission.status === 'REJECTED') {
          throw new Error(`Demo proof ${input.idempotencyKey} was already rejected.`);
        }
        await reconcileApprovedSubmission(submission, student);
      } else {
        if (submission.status === 'APPROVED') {
          throw new Error(`Demo proof ${input.idempotencyKey} was already approved.`);
        }
        await reconcileRejectedSubmission(submission, input.rejectionReason ?? 'Demo rejection.');
      }
      submission = (
        await db
          .select()
          .from(schema.paymentSubmissions)
          .where(eq(schema.paymentSubmissions.id, submission.id))
          .limit(1)
      )[0];
      if (!submission)
        throw new Error(`Demo proof ${input.idempotencyKey} disappeared during reconciliation.`);
    }

    await ensureProofRecord(submission.id);
    const payment = submission.approvedPaymentId
      ? (
          await db
            .select()
            .from(schema.payments)
            .where(eq(schema.payments.id, submission.approvedPaymentId))
            .limit(1)
        )[0]
      : undefined;
    const receipt = payment
      ? (
          await db
            .select()
            .from(schema.receipts)
            .where(eq(schema.receipts.paymentId, payment.id))
            .limit(1)
        )[0]
      : undefined;
    await ensureProofNotifications({
      student,
      submission,
      payment,
      receipt,
      rejectionReason: input.rejectionReason,
    });
  };

  await ensureSubmission({
    studentNumber: 'DEMO-0001',
    paymentChannel: 'GCASH',
    amountCentavos: 50_000_00,
    referenceNumber: 'DEMO-GCASH-APPROVED',
    idempotencyKey: 'seed-proof-gcash-approved',
    decision: 'APPROVE',
  });
  await ensureSubmission({
    studentNumber: 'DEMO-0001',
    paymentChannel: 'MAYA',
    amountCentavos: 10_000_00,
    referenceNumber: 'DEMO-MAYA-REJECTED',
    idempotencyKey: 'seed-proof-maya-rejected',
    decision: 'REJECT',
    rejectionReason: 'Demo rejection: upload a clearer transfer confirmation.',
  });
}

export async function seedDemoData(db: DatabaseInstance = getDb()) {
  console.log('🌱 Seeding deterministic fictional demo data...');
  const schoolYear = await ensureSchoolYear(db);
  if (!schoolYear) throw new Error('Failed to resolve active school year.');
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
  await ensureDemoAnnouncements(db, admin.id);
  await ensureDemoPaymentProofs(db, parent.id, finance.id, students, assessments);

  console.log(
    `✅ Demo seed ready: 1 active school year, ${students.length} students, ${guardians.length} guardians, ${assessments.size} assessments, and persisted payment/receipt/audit/notification fixtures.`
  );
}

if (process.argv[1]?.includes('seed.ts')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error('SEED ERROR:', error);
      logSanitizedError('database.seed', error);
      process.exit(1);
    });
}
