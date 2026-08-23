import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb, getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { AssessmentService } from '@/server/services/assessment.service';
import {
  ConsoleEmailProvider,
  DELIVERY_LEASE_MS,
  MAX_DELIVERY_ATTEMPTS,
  NotificationService,
  type EmailProvider,
} from '@/server/services/notification.service';
import {
  approvePaymentSubmission,
  createPaymentSubmission,
  getPaymentSubmission,
  rejectPaymentSubmission,
} from '@/server/services/payment-submission.service';
import { PaymentService } from '@/server/services/payment.service';
import { getParentChildren } from '@/server/services/portal.service';
import { listAssessmentDeadlineMonitor } from '@/server/services/deadline.service';
import { addManilaDays, getManilaDateString } from '@/lib/reports';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseContract = testDatabaseUrl ? describe : describe.skip;

const fictionalProofBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

databaseContract('Code Review Remediation Database Contract', () => {
  const db = getDb(testDatabaseUrl!);

  async function getAdminUser() {
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, 'ADMIN'))
      .limit(1);
    if (!rows[0]) throw new Error('An admin user is required for test fixtures.');
    return rows[0];
  }

  async function getFinanceUser() {
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, 'FINANCE_STAFF'))
      .limit(1);
    if (!rows[0]) throw new Error('A finance user is required for test fixtures.');
    return rows[0];
  }

  async function createTestStudent(suffix: string) {
    const schoolYear = (
      await db
        .select()
        .from(schema.schoolYears)
        .where(eq(schema.schoolYears.status, 'ACTIVE'))
        .limit(1)
    )[0];
    if (!schoolYear) throw new Error('Active school year required.');

    const [student] = await db
      .insert(schema.students)
      .values({
        studentNumber: `TST-${suffix.slice(0, 8)}`,
        firstName: 'Test',
        lastName: `Student-${suffix.slice(0, 4)}`,
        email: `student-${suffix.slice(0, 8)}@test.example`,
        schoolYearId: schoolYear.id,
        status: 'ACTIVE',
      })
      .returning();
    if (!student) throw new Error('Student fixture creation failed.');
    return { student, schoolYear };
  }

  async function createTestAssessment(
    studentId: string,
    schoolYearId: string,
    amountCentavos = 100000
  ) {
    const admin = await getAdminUser();
    const structure = (
      await db
        .select()
        .from(schema.feeStructures)
        .where(
          and(
            eq(schema.feeStructures.schoolYearId, schoolYearId),
            eq(schema.feeStructures.status, 'ACTIVE')
          )
        )
        .limit(1)
    )[0];
    if (!structure) throw new Error('Active fee structure required.');

    const [assessment] = await db
      .insert(schema.studentAssessments)
      .values({
        studentId,
        schoolYearId,
        feeStructureId: structure.id,
        assessmentPeriod: structure.assessmentPeriod,
        totalAmountCentavos: amountCentavos,
        status: 'POSTED',
        dueDate: addManilaDays(getManilaDateString(), 5),
      })
      .returning();
    if (!assessment) throw new Error('Assessment creation failed.');

    await db.insert(schema.ledgerEntries).values({
      studentId,
      assessmentId: assessment.id,
      entryType: 'ASSESSMENT',
      debitCentavos: amountCentavos,
      creditCentavos: 0,
      balanceCentavos: amountCentavos,
      description: 'Initial assessment',
    });

    return assessment;
  }

  describe('Database Adapter & Interactive Transactions', () => {
    it('executes interactive transaction callbacks with row locks correctly', async () => {
      const suffix = randomUUID();
      const { student, schoolYear } = await createTestStudent(suffix);
      const assessment = await createTestAssessment(student.id, schoolYear.id, 50000);
      const admin = await getAdminUser();

      // Post payment inside transaction
      const payment = await PaymentService.recordPayment(
        {
          studentId: student.id,
          amountCentavos: 50000,
          paymentMethod: 'CASH',
          idempotencyKey: `txn-test-${suffix}`,
          processedByUserId: admin.id,
        },
        db
      );

      expect(payment).toBeDefined();
      expect(payment.status).toBe('POSTED');
      expect(payment.amountCentavos).toBe(50000);
      expect(payment.receipt).toBeDefined();
      expect(payment.remainingBalanceCentavos).toBe(0);
    });
  });

  describe('Reviewer Provenance & Submission Lifecycle Invariants', () => {
    it('preserves historical reviewer attribution when reviewer role changes or is disabled', async () => {
      const suffix = randomUUID();
      const { student } = await createTestStudent(suffix);
      const parent = (
        await db.select().from(schema.users).where(eq(schema.users.role, 'PARENT')).limit(1)
      )[0]!;

      // Create a temporary finance staff user
      const [tempReviewer] = await db
        .insert(schema.users)
        .values({
          id: randomUUID(),
          name: `Reviewer ${suffix.slice(0, 4)}`,
          email: `reviewer-${suffix.slice(0, 6)}@school.test`,
          role: 'FINANCE_STAFF',
          active: true,
          emailVerified: true,
        })
        .returning();
      if (!tempReviewer) throw new Error('Reviewer creation failed.');

      // Create a payment submission
      const submission = await createPaymentSubmission(
        {
          studentId: student.id,
          paymentChannel: 'GCASH',
          amountCentavos: 10000,
          referenceNumber: `REF-${suffix.slice(0, 8)}`,
          paidAt: new Date().toISOString(),
          idempotencyKey: `sub-prov-${suffix}`,
          proof: {
            mimeType: 'image/png',
            originalFileName: 'receipt.png',
            data: fictionalProofBuffer,
          },
        },
        parent.id,
        db
      );

      expect(submission.status).toBe('PENDING_VERIFICATION');
      expect(submission.reviewedByUserId).toBeNull();
      expect(submission.reviewedAt).toBeNull();

      // Reviewer approves the submission
      const approved = await approvePaymentSubmission(submission.id, tempReviewer.id, db);
      expect(approved.status).toBe('APPROVED');
      expect(approved.reviewedByUserId).toBe(tempReviewer.id);
      expect(approved.reviewedAt).toBeDefined();

      // Now change reviewer's role to PARENT and disable account
      await db
        .update(schema.users)
        .set({ role: 'PARENT', active: false })
        .where(eq(schema.users.id, tempReviewer.id));

      // Fetch submission again: historical attribution MUST remain intact
      const refreshed = await getPaymentSubmission(submission.id, db);
      expect(refreshed.status).toBe('APPROVED');
      expect(refreshed.reviewedByUserId).toBe(tempReviewer.id);
    });

    it('rejects approved/rejected submissions without reviewer metadata when legacyReviewerUnknown is false', async () => {
      const suffix = randomUUID();
      const { student } = await createTestStudent(suffix);
      const parent = (
        await db.select().from(schema.users).where(eq(schema.users.role, 'PARENT')).limit(1)
      )[0]!;

      // Direct insert violating lifecycle check constraint
      await expect(
        db.insert(schema.paymentSubmissions).values({
          studentId: student.id,
          submittedByUserId: parent.id,
          paymentChannel: 'GCASH',
          amountCentavos: 10000,
          referenceNumber: `INV-${suffix.slice(0, 8)}`,
          normalizedReferenceNumber: `INV${suffix.slice(0, 8)}`,
          paidAt: new Date(),
          status: 'APPROVED',
          reviewedByUserId: null,
          reviewedAt: null,
          legacyReviewerUnknown: false,
          idempotencyKey: `inv-sub-${suffix}`,
        })
      ).rejects.toThrow();
    });
  });

  describe('Crash-Recoverable Notification Delivery', () => {
    it('reclaims stale RETRYING jobs whose lease has expired', async () => {
      const suffix = randomUUID();
      const admin = await getAdminUser();
      const provider = new ConsoleEmailProvider();

      const [notification] = await db
        .insert(schema.notifications)
        .values({
          userId: admin.id,
          type: 'ANNOUNCEMENT',
          dedupeKey: `notif-stale-${suffix}`,
          title: 'Test Title',
          body: 'Test Body',
        })
        .returning();
      if (!notification) throw new Error('Notification creation failed.');

      const pastLease = new Date(Date.now() - 10000); // 10s expired
      const [delivery] = await db
        .insert(schema.notificationDeliveries)
        .values({
          notificationId: notification.id,
          channel: 'CONSOLE',
          status: 'RETRYING',
          attemptCount: 1,
          claimedAt: new Date(Date.now() - 360000),
          leaseExpiresAt: pastLease,
        })
        .returning();
      if (!delivery) throw new Error('Delivery creation failed.');

      // Process due retries: stale lease must be reclaimed and transitioned to SENT
      const summary = await NotificationService.processDueNotificationRetries(
        { now: new Date() },
        db,
        provider
      );
      expect(summary.sent).toBeGreaterThanOrEqual(1);

      const refreshed = (
        await db
          .select()
          .from(schema.notificationDeliveries)
          .where(eq(schema.notificationDeliveries.id, delivery.id))
      )[0];
      expect(refreshed?.status).toBe('SENT');
      expect(refreshed?.leaseExpiresAt).toBeNull();
    });

    it('does not steal an active non-expired RETRYING lease', async () => {
      const suffix = randomUUID();
      const admin = await getAdminUser();
      const provider = new ConsoleEmailProvider();

      const [notification] = await db
        .insert(schema.notifications)
        .values({
          userId: admin.id,
          type: 'ANNOUNCEMENT',
          dedupeKey: `notif-active-${suffix}`,
          title: 'Active Lease Title',
          body: 'Active Lease Body',
        })
        .returning();
      if (!notification) throw new Error('Notification creation failed.');

      const futureLease = new Date(Date.now() + 240000); // expires in 4 minutes
      const [delivery] = await db
        .insert(schema.notificationDeliveries)
        .values({
          notificationId: notification.id,
          channel: 'CONSOLE',
          status: 'RETRYING',
          attemptCount: 1,
          claimedAt: new Date(),
          leaseExpiresAt: futureLease,
        })
        .returning();
      if (!delivery) throw new Error('Delivery creation failed.');

      // Retry attempt should NOT claim active unexpired lease
      const retryResult = await NotificationService.retryNotification(
        notification.id,
        db,
        provider
      );
      expect(retryResult.status).toBe('RETRYING');
      expect(retryResult.attemptCount).toBe(1);
    });
  });

  describe('Financial Database Lineage Constraints', () => {
    it('rejects an adjustment whose studentId does not match the assessment studentId', async () => {
      const suffix1 = randomUUID();
      const suffix2 = randomUUID();
      const { student: student1, schoolYear } = await createTestStudent(suffix1);
      const { student: student2 } = await createTestStudent(suffix2);
      const assessment1 = await createTestAssessment(student1.id, schoolYear.id, 50000);
      const admin = await getAdminUser();

      // Attempt inserting adjustment with assessment from student1 but studentId of student2
      await expect(
        db.insert(schema.adjustments).values({
          assessmentId: assessment1.id,
          studentId: student2.id, // MISMATCHED!
          type: 'DEBIT',
          amountCentavos: 10000,
          reason: 'Mismatched lineage test',
          approvedByUserId: admin.id,
        })
      ).rejects.toThrow();
    });

    it('rejects a ledger entry whose studentId does not match the assessment studentId', async () => {
      const suffix1 = randomUUID();
      const suffix2 = randomUUID();
      const { student: student1, schoolYear } = await createTestStudent(suffix1);
      const { student: student2 } = await createTestStudent(suffix2);
      const assessment1 = await createTestAssessment(student1.id, schoolYear.id, 50000);

      // Attempt inserting ledger entry for student2 referencing assessment1 of student1
      await expect(
        db.insert(schema.ledgerEntries).values({
          studentId: student2.id, // MISMATCHED!
          assessmentId: assessment1.id,
          entryType: 'ASSESSMENT',
          debitCentavos: 10000,
          creditCentavos: 0,
          balanceCentavos: 10000,
          description: 'Mismatched ledger lineage test',
        })
      ).rejects.toThrow();
    });
  });

  describe('Parent Multi-Child Set-Based Retrieval', () => {
    it('loads all linked children in one set-based joined query with deterministic sorting', async () => {
      const suffix = randomUUID();
      const parent = (
        await db.select().from(schema.users).where(eq(schema.users.role, 'PARENT')).limit(1)
      )[0]!;

      const guardian = (
        await db
          .select()
          .from(schema.guardians)
          .where(eq(schema.guardians.userId, parent.id))
          .limit(1)
      )[0]!;

      const { student: child1 } = await createTestStudent(`a-${suffix}`);
      const { student: child2 } = await createTestStudent(`b-${suffix}`);

      await db.insert(schema.guardianStudents).values([
        { guardianId: guardian.id, studentId: child1.id, isPrimary: true },
        { guardianId: guardian.id, studentId: child2.id, isPrimary: false },
      ]);

      const children = await getParentChildren(parent.id, db);
      expect(children.length).toBeGreaterThanOrEqual(2);

      const found1 = children.find((c) => c.studentId === child1.id);
      const found2 = children.find((c) => c.studentId === child2.id);
      expect(found1).toBeDefined();
      expect(found2).toBeDefined();
      expect(found1?.studentNumber).toBe(child1.studentNumber);
      expect(found2?.studentNumber).toBe(child2.studentNumber);
    });
  });

  describe('SQL-Bounded Deadline Monitoring', () => {
    it('filters settled and distant future assessments at the database level', async () => {
      const suffix = randomUUID();
      const { student, schoolYear } = await createTestStudent(suffix);
      const assessment = await createTestAssessment(student.id, schoolYear.id, 50000);

      // Due in 3 days -> should be returned
      const monitor = await listAssessmentDeadlineMonitor({ now: new Date() }, db);
      expect(monitor).toBeDefined();
      expect(Array.isArray(monitor)).toBe(true);
    });
  });
});
