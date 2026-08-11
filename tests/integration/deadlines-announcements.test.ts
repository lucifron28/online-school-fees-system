import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { addManilaDays, getManilaDateString } from '@/lib/reports';
import { calculateAssessmentDueDate, evaluateDeadline } from '@/lib/deadlines';
import {
  createAnnouncement,
  listVisibleAnnouncements,
  publishDueAnnouncements,
} from '@/server/services/announcement.service';
import { getOrCreateSchoolSettings } from '@/server/services/administration.service';
import { AssessmentService } from '@/server/services/assessment.service';
import { ConsoleEmailProvider, NotificationService } from '@/server/services/notification.service';
import { ReminderService } from '@/server/services/reminder.service';
import { listAssessmentDeadlineMonitor } from '@/server/services/deadline.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseContract = testDatabaseUrl ? describe.sequential : describe.skip;

databaseContract('Payment deadlines and announcements PostgreSQL contract', () => {
  let db: DatabaseInstance;
  let activeSchoolYearId: string;
  let activeGradeLevelId: string;
  let activeFeeStructureId: string;
  let adminUserId: string;
  let originalSettings: { defaultPaymentTermDays: number; reminderLeadDays: number };
  const assessmentIds: string[] = [];
  const studentIds: string[] = [];
  const userIds: string[] = [];
  const guardianIds: string[] = [];
  const guardianStudentIds: string[] = [];
  const announcementIds: string[] = [];
  const now = new Date('2026-08-11T04:00:00.000Z');

  beforeAll(async () => {
    db = getDb(testDatabaseUrl!);
    const [schoolYear] = await db
      .select({ id: schema.schoolYears.id })
      .from(schema.schoolYears)
      .where(eq(schema.schoolYears.status, 'ACTIVE'))
      .orderBy(asc(schema.schoolYears.startDate))
      .limit(1);
    const [gradeLevel] = await db
      .select({ id: schema.gradeLevels.id })
      .from(schema.gradeLevels)
      .orderBy(asc(schema.gradeLevels.displayOrder))
      .limit(1);
    const [feeStructure] = await db
      .select({
        id: schema.feeStructures.id,
        schoolYearId: schema.feeStructures.schoolYearId,
        gradeLevelId: schema.feeStructures.gradeLevelId,
      })
      .from(schema.feeStructures)
      .innerJoin(schema.schoolYears, eq(schema.schoolYears.id, schema.feeStructures.schoolYearId))
      .where(
        and(eq(schema.feeStructures.status, 'ACTIVE'), eq(schema.schoolYears.status, 'ACTIVE'))
      )
      .orderBy(asc(schema.feeStructures.createdAt))
      .limit(1);
    const [admin] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.email, 'admin@demo.school'), eq(schema.users.role, 'ADMIN')))
      .limit(1);
    if (!schoolYear || !gradeLevel || !feeStructure || !admin) {
      throw new Error('Seeded active school year, grade, fee structure, and admin are required.');
    }
    activeSchoolYearId = feeStructure.schoolYearId;
    activeGradeLevelId = feeStructure.gradeLevelId;
    activeFeeStructureId = feeStructure.id;
    adminUserId = admin.id;
    const settings = await getOrCreateSchoolSettings(db);
    originalSettings = {
      defaultPaymentTermDays: settings.defaultPaymentTermDays,
      reminderLeadDays: settings.reminderLeadDays,
    };
  });

  beforeEach(async () => {
    await db
      .update(schema.schoolSettings)
      .set({ defaultPaymentTermDays: 7, reminderLeadDays: 2, updatedAt: new Date() })
      .where(eq(schema.schoolSettings.singletonKey, 'default'));
  });

  afterAll(async () => {
    if (!db) return;
    const notificationConditions = [
      assessmentIds.length > 0 ? inArray(schema.notifications.entityId, assessmentIds) : undefined,
      announcementIds.length > 0
        ? inArray(schema.notifications.entityId, announcementIds)
        : undefined,
    ].filter(Boolean) as Array<ReturnType<typeof inArray>>;
    if (notificationConditions.length > 0) {
      const notifications = await db
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(or(...notificationConditions));
      if (notifications.length > 0) {
        const notificationIds = notifications.map((row) => row.id);
        await db
          .delete(schema.notificationDeliveries)
          .where(inArray(schema.notificationDeliveries.notificationId, notificationIds));
        await db
          .delete(schema.notifications)
          .where(inArray(schema.notifications.id, notificationIds));
      }
    }
    if (announcementIds.length > 0) {
      await db
        .delete(schema.announcements)
        .where(inArray(schema.announcements.id, announcementIds));
    }
    if (guardianStudentIds.length > 0) {
      await db
        .delete(schema.guardianStudents)
        .where(inArray(schema.guardianStudents.id, guardianStudentIds));
    }
    if (guardianIds.length > 0) {
      await db.delete(schema.guardians).where(inArray(schema.guardians.id, guardianIds));
    }
    if (assessmentIds.length > 0) {
      await db
        .delete(schema.ledgerEntries)
        .where(inArray(schema.ledgerEntries.assessmentId, assessmentIds));
      await db
        .delete(schema.assessmentItems)
        .where(inArray(schema.assessmentItems.assessmentId, assessmentIds));
      await db
        .delete(schema.studentAssessments)
        .where(inArray(schema.studentAssessments.id, assessmentIds));
    }
    if (studentIds.length > 0) {
      await db.delete(schema.students).where(inArray(schema.students.id, studentIds));
    }
    if (userIds.length > 0) {
      await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    }
    await db
      .update(schema.schoolSettings)
      .set({ ...originalSettings, updatedAt: new Date() })
      .where(eq(schema.schoolSettings.singletonKey, 'default'));
  });

  async function createAssessment(input: { dueDate: string; name?: string }) {
    const suffix = randomUUID();
    const studentUserId = randomUUID();
    await db.insert(schema.users).values({
      id: studentUserId,
      name: input.name ?? `Deadline student ${suffix}`,
      email: `deadline-student-${suffix}@example.com`,
      role: 'STUDENT',
      active: true,
      emailVerified: true,
    });
    userIds.push(studentUserId);
    const [student] = await db
      .insert(schema.students)
      .values({
        studentNumber: `DEADLINE-${suffix.slice(0, 8)}`,
        firstName: 'Deadline',
        lastName: `Student ${suffix.slice(0, 8)}`,
        email: `deadline-student-${suffix}@example.com`,
        userId: studentUserId,
        gradeLevelId: activeGradeLevelId,
        sectionId: null,
        schoolYearId: activeSchoolYearId,
        status: 'ACTIVE',
      })
      .returning();
    if (!student) throw new Error('Deadline test student could not be created.');
    studentIds.push(student.id);
    const assessment = await AssessmentService.generateAssessment(
      {
        studentId: student.id,
        feeStructureId: activeFeeStructureId,
        dueDate: input.dueDate,
        actorUserId: adminUserId,
      },
      db
    );
    assessmentIds.push(assessment.id);
    return { assessment, student, studentUserId };
  }

  async function createParentLink(studentId: string) {
    const suffix = randomUUID();
    const parentUserId = randomUUID();
    await db.insert(schema.users).values({
      id: parentUserId,
      name: `Linked parent ${suffix}`,
      email: `deadline-parent-${suffix}@example.com`,
      role: 'PARENT',
      active: true,
      emailVerified: true,
    });
    userIds.push(parentUserId);
    const [guardian] = await db
      .insert(schema.guardians)
      .values({
        userId: parentUserId,
        firstName: 'Linked',
        lastName: 'Parent',
        email: `deadline-parent-${suffix}@example.com`,
        phone: '+63 900 000 0000',
        relationship: 'Parent',
        address: 'Deadline test address',
      })
      .returning();
    if (!guardian) throw new Error('Deadline test guardian could not be created.');
    guardianIds.push(guardian.id);
    const [link] = await db
      .insert(schema.guardianStudents)
      .values({ guardianId: guardian.id, studentId, isPrimary: true })
      .returning();
    if (!link) throw new Error('Deadline test guardian link could not be created.');
    guardianStudentIds.push(link.id);
    return parentUserId;
  }

  async function markPaid(studentId: string, assessmentId: string, amountCentavos: number) {
    await db.insert(schema.ledgerEntries).values({
      studentId,
      assessmentId,
      entryType: 'PAYMENT',
      debitCentavos: 0,
      creditCentavos: amountCentavos,
      balanceCentavos: 0,
      description: 'Deadline test payment',
    });
  }

  async function notificationRows(
    assessmentId: string,
    type: 'PAYMENT_DUE_REMINDER' | 'ANNOUNCEMENT'
  ) {
    return db
      .select({ userId: schema.notifications.userId, id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(eq(schema.notifications.entityId, assessmentId), eq(schema.notifications.type, type))
      );
  }

  it('uses the seven-day default, accepts a custom due date, and preserves old dates after settings change', async () => {
    const defaultAssessment = await createAssessment({
      dueDate: calculateAssessmentDueDate(new Date(), 7),
    });
    expect(defaultAssessment.assessment.dueDate).toBe(calculateAssessmentDueDate(new Date(), 7));

    const customDueDate = '2026-09-30';
    const customAssessment = await createAssessment({ dueDate: customDueDate });
    expect(customAssessment.assessment.dueDate).toBe(customDueDate);

    await db
      .update(schema.schoolSettings)
      .set({ defaultPaymentTermDays: 30, updatedAt: new Date() })
      .where(eq(schema.schoolSettings.singletonKey, 'default'));
    const newAssessment = await createAssessment({
      dueDate: calculateAssessmentDueDate(new Date(), 30),
    });
    expect(defaultAssessment.assessment.dueDate).not.toBe(newAssessment.assessment.dueDate);
    expect(customAssessment.assessment.dueDate).toBe(customDueDate);
  });

  it('calculates deadlines on Manila calendar boundaries', () => {
    expect(calculateAssessmentDueDate(new Date('2026-08-01T15:59:59.000Z'), 7)).toBe('2026-08-08');
    expect(calculateAssessmentDueDate(new Date('2026-08-01T16:00:00.000Z'), 7)).toBe('2026-08-09');
  });

  it('separates PAID, ON_TRACK, DUE_SOON, and OVERDUE states', () => {
    expect(
      evaluateDeadline({
        balanceCentavos: 0,
        dueDate: '2026-08-01',
        reminderLeadDays: 2,
        today: '2026-08-11',
      })
    ).toMatchObject({ paymentStatus: 'PAID', deadlineState: 'PAID' });
    expect(
      evaluateDeadline({
        balanceCentavos: 100,
        dueDate: '2026-08-20',
        reminderLeadDays: 2,
        today: '2026-08-11',
      })
    ).toMatchObject({ paymentStatus: 'WITH_REMAINING_BALANCE', deadlineState: 'ON_TRACK' });
    expect(
      evaluateDeadline({
        balanceCentavos: 100,
        dueDate: '2026-08-13',
        reminderLeadDays: 2,
        today: '2026-08-11',
      })
    ).toMatchObject({ paymentStatus: 'WITH_REMAINING_BALANCE', deadlineState: 'DUE_SOON' });
    expect(
      evaluateDeadline({
        balanceCentavos: 100,
        dueDate: '2026-08-10',
        reminderLeadDays: 2,
        today: '2026-08-11',
      })
    ).toMatchObject({ paymentStatus: 'WITH_REMAINING_BALANCE', deadlineState: 'OVERDUE' });
  });

  it('persists due-soon and overdue monitor rows while excluding fully paid rows', async () => {
    const dueSoon = await createAssessment({ dueDate: addManilaDays(getManilaDateString(now), 2) });
    const overdue = await createAssessment({
      dueDate: addManilaDays(getManilaDateString(now), -1),
    });
    const paid = await createAssessment({ dueDate: addManilaDays(getManilaDateString(now), -1) });
    await markPaid(paid.student.id, paid.assessment.id, paid.assessment.totalAmountCentavos);
    const rows = await listAssessmentDeadlineMonitor({ now }, db);
    expect(rows.find((row) => row.assessmentId === dueSoon.assessment.id)?.deadlineState).toBe(
      'DUE_SOON'
    );
    expect(rows.find((row) => row.assessmentId === overdue.assessment.id)?.deadlineState).toBe(
      'OVERDUE'
    );
    expect(rows.some((row) => row.assessmentId === paid.assessment.id)).toBe(false);
  });

  it('does not remind a fully paid assessment, deduplicates reruns, and creates a new key after a due-date change', async () => {
    const paid = await createAssessment({ dueDate: addManilaDays(getManilaDateString(now), 1) });
    await markPaid(paid.student.id, paid.assessment.id, paid.assessment.totalAmountCentavos);
    await ReminderService.runDueReminders({ now }, db, new ConsoleEmailProvider());
    expect((await notificationRows(paid.assessment.id, 'PAYMENT_DUE_REMINDER')).length).toBe(0);

    const dueSoon = await createAssessment({ dueDate: addManilaDays(getManilaDateString(now), 1) });
    const first = await ReminderService.runDueReminders({ now }, db, new ConsoleEmailProvider());
    const second = await ReminderService.runDueReminders({ now }, db, new ConsoleEmailProvider());
    expect(first.created).toBeGreaterThan(0);
    expect(second.deduplicated).toBeGreaterThan(0);
    expect((await notificationRows(dueSoon.assessment.id, 'PAYMENT_DUE_REMINDER')).length).toBe(1);

    await db
      .update(schema.studentAssessments)
      .set({ dueDate: addManilaDays(getManilaDateString(now), 2), updatedAt: new Date() })
      .where(eq(schema.studentAssessments.id, dueSoon.assessment.id));
    await ReminderService.runDueReminders({ now }, db, new ConsoleEmailProvider());
    expect((await notificationRows(dueSoon.assessment.id, 'PAYMENT_DUE_REMINDER')).length).toBe(2);
  });

  it('sends reminders to the linked parent and excludes an unrelated parent', async () => {
    const dueSoon = await createAssessment({ dueDate: addManilaDays(getManilaDateString(now), 1) });
    const linkedParentId = await createParentLink(dueSoon.student.id);
    const unrelatedParentId = randomUUID();
    await db.insert(schema.users).values({
      id: unrelatedParentId,
      name: 'Unrelated deadline parent',
      email: `unrelated-deadline-parent-${unrelatedParentId}@example.com`,
      role: 'PARENT',
      active: true,
      emailVerified: true,
    });
    userIds.push(unrelatedParentId);
    await ReminderService.runDueReminders({ now }, db, new ConsoleEmailProvider());
    const rows = await notificationRows(dueSoon.assessment.id, 'PAYMENT_DUE_REMINDER');
    expect(rows.some((row) => row.userId === linkedParentId)).toBe(true);
    expect(rows.some((row) => row.userId === unrelatedParentId)).toBe(false);
  });

  it('keeps drafts, future schedules, and expired announcements out of current portal visibility', async () => {
    const draft = await createAnnouncement(
      {
        title: 'Draft payment notice',
        body: 'Draft body',
        audience: 'PARENT',
        status: 'DRAFT',
        publishAt: now,
      },
      adminUserId,
      db,
      new ConsoleEmailProvider()
    );
    announcementIds.push(draft.id);
    const future = await createAnnouncement(
      {
        title: 'Future payment notice',
        body: 'Future body',
        audience: 'PARENT',
        status: 'SCHEDULED',
        publishAt: new Date(now.getTime() + 86_400_000),
      },
      adminUserId,
      db,
      new ConsoleEmailProvider()
    );
    announcementIds.push(future.id);
    const expired = await createAnnouncement(
      {
        title: 'Expired payment notice',
        body: 'Expired body',
        audience: 'PARENT',
        status: 'PUBLISHED',
        publishAt: new Date(now.getTime() - 172_800_000),
        expiresAt: new Date(now.getTime() - 86_400_000),
      },
      adminUserId,
      db,
      new ConsoleEmailProvider()
    );
    announcementIds.push(expired.id);
    const visible = await listVisibleAnnouncements({ audience: 'PARENT', now }, db);
    expect(visible.some((announcement) => announcement.id === draft.id)).toBe(false);
    expect(visible.some((announcement) => announcement.id === future.id)).toBe(false);
    expect(visible.some((announcement) => announcement.id === expired.id)).toBe(false);
  });

  it('publishes due schedules for portal visibility and deduplicates announcement notifications', async () => {
    const [scheduled] = await db
      .insert(schema.announcements)
      .values({
        title: 'Scheduled payment notice',
        body: 'Scheduled body',
        audience: 'PARENT_AND_STUDENT',
        status: 'SCHEDULED',
        publishAt: new Date(now.getTime() - 1_000),
        expiresAt: null,
        createdByUserId: adminUserId,
        updatedByUserId: adminUserId,
      })
      .returning();
    if (!scheduled) throw new Error('Scheduled announcement could not be created.');
    announcementIds.push(scheduled.id);
    const result = await publishDueAnnouncements({ now }, db, new ConsoleEmailProvider());
    expect(result.published).toBe(1);
    const visibleParent = await listVisibleAnnouncements({ audience: 'PARENT', now }, db);
    expect(visibleParent.some((announcement) => announcement.id === scheduled.id)).toBe(true);
    const first = await notificationRows(scheduled.id, 'ANNOUNCEMENT');
    await NotificationService.notifyAnnouncementPublished(
      scheduled.id,
      db,
      new ConsoleEmailProvider()
    );
    const second = await notificationRows(scheduled.id, 'ANNOUNCEMENT');
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBe(first.length);
  });
});
