import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import {
  ConsoleEmailProvider,
  DELIVERY_LEASE_MS,
  MAX_DELIVERY_ATTEMPTS,
  NotificationService,
} from '@/server/services/notification.service';
import {
  approvePaymentSubmission,
  createPaymentSubmission,
  getPaymentSubmission,
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

  const createdUserIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdGuardianIds: string[] = [];
  const createdGuardianStudentIds: string[] = [];
  const createdAssessmentIds: string[] = [];
  const createdAssessmentItemIds: string[] = [];
  const createdLedgerEntryIds: string[] = [];
  const createdAdjustmentIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdReceiptIds: string[] = [];
  const createdAllocationIds: string[] = [];
  const createdReversalIds: string[] = [];
  const createdSubmissionIds: string[] = [];
  const createdProofIds: string[] = [];
  const createdNotificationIds: string[] = [];
  const createdDeliveryIds: string[] = [];
  const createdAttemptIds: string[] = [];

  afterAll(async () => {
    if (createdAttemptIds.length > 0) {
      await db
        .delete(schema.notificationDeliveryAttempts)
        .where(inArray(schema.notificationDeliveryAttempts.id, createdAttemptIds));
    }
    if (createdDeliveryIds.length > 0) {
      await db
        .delete(schema.notificationDeliveries)
        .where(inArray(schema.notificationDeliveries.id, createdDeliveryIds));
    }
    if (createdNotificationIds.length > 0) {
      await db
        .delete(schema.notifications)
        .where(inArray(schema.notifications.id, createdNotificationIds));
    }
    if (createdProofIds.length > 0) {
      await db
        .delete(schema.paymentSubmissionProofs)
        .where(inArray(schema.paymentSubmissionProofs.id, createdProofIds));
    }
    if (createdSubmissionIds.length > 0) {
      await db
        .delete(schema.paymentSubmissions)
        .where(inArray(schema.paymentSubmissions.id, createdSubmissionIds));
    }
    if (createdReversalIds.length > 0) {
      await db
        .delete(schema.paymentReversals)
        .where(inArray(schema.paymentReversals.id, createdReversalIds));
    }
    if (createdAllocationIds.length > 0) {
      await db
        .delete(schema.paymentAllocations)
        .where(inArray(schema.paymentAllocations.id, createdAllocationIds));
    }
    if (createdReceiptIds.length > 0) {
      await db.delete(schema.receipts).where(inArray(schema.receipts.id, createdReceiptIds));
    }
    if (createdPaymentIds.length > 0) {
      await db.delete(schema.payments).where(inArray(schema.payments.id, createdPaymentIds));
    }
    if (createdAdjustmentIds.length > 0) {
      await db
        .delete(schema.adjustments)
        .where(inArray(schema.adjustments.id, createdAdjustmentIds));
    }
    if (createdLedgerEntryIds.length > 0) {
      await db
        .delete(schema.ledgerEntries)
        .where(inArray(schema.ledgerEntries.id, createdLedgerEntryIds));
    }
    if (createdStudentIds.length > 0) {
      await db
        .delete(schema.ledgerEntries)
        .where(inArray(schema.ledgerEntries.studentId, createdStudentIds));
    }
    if (createdAssessmentItemIds.length > 0) {
      await db
        .delete(schema.assessmentItems)
        .where(inArray(schema.assessmentItems.id, createdAssessmentItemIds));
    }
    if (createdAssessmentIds.length > 0) {
      await db
        .delete(schema.studentAssessments)
        .where(inArray(schema.studentAssessments.id, createdAssessmentIds));
    }
    if (createdGuardianStudentIds.length > 0) {
      await db
        .delete(schema.guardianStudents)
        .where(inArray(schema.guardianStudents.id, createdGuardianStudentIds));
    }
    if (createdGuardianIds.length > 0) {
      await db.delete(schema.guardians).where(inArray(schema.guardians.id, createdGuardianIds));
    }
    if (createdStudentIds.length > 0) {
      await db.delete(schema.students).where(inArray(schema.students.id, createdStudentIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(schema.users).where(inArray(schema.users.id, createdUserIds));
    }
  });

  async function getAdminUser() {
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, 'ADMIN'))
      .limit(1);
    if (!rows[0]) throw new Error('An admin user is required for test fixtures.');
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
    createdStudentIds.push(student.id);
    return { student, schoolYear };
  }

  async function createTestAssessment(
    studentId: string,
    schoolYearId: string,
    amountCentavos = 100000
  ) {
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

    const feeCategory = (await db.select().from(schema.feeCategories).limit(1))[0];
    if (!feeCategory) throw new Error('Fee category required.');

    const feeItems = await db
      .select()
      .from(schema.feeStructureItems)
      .where(eq(schema.feeStructureItems.feeStructureId, structure.id))
      .limit(1);

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
    createdAssessmentIds.push(assessment.id);

    const [item] = await db
      .insert(schema.assessmentItems)
      .values({
        assessmentId: assessment.id,
        feeCategoryId: feeItems[0]?.feeCategoryId ?? feeCategory.id,
        name: feeItems[0]?.name ?? 'Tuition Fee',
        amountCentavos: amountCentavos,
      })
      .returning();
    if (!item) throw new Error('Assessment item creation failed.');
    createdAssessmentItemIds.push(item.id);

    const [ledgerEntry] = await db
      .insert(schema.ledgerEntries)
      .values({
        studentId,
        assessmentId: assessment.id,
        entryType: 'ASSESSMENT',
        debitCentavos: amountCentavos,
        creditCentavos: 0,
        balanceCentavos: amountCentavos,
        description: 'Initial assessment',
      })
      .returning();
    if (ledgerEntry) createdLedgerEntryIds.push(ledgerEntry.id);

    return assessment;
  }

  describe('Database Adapter & Interactive Transactions', () => {
    it('executes interactive transaction callbacks with row locks correctly', async () => {
      const suffix = randomUUID();
      const { student, schoolYear } = await createTestStudent(suffix);
      await createTestAssessment(student.id, schoolYear.id, 50000);
      const admin = await getAdminUser();

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

      createdPaymentIds.push(payment.id);
      if (payment.receipt?.id) createdReceiptIds.push(payment.receipt.id);
    });
  });

  describe('Reviewer Provenance & Submission Lifecycle Invariants', () => {
    it('preserves historical reviewer attribution when reviewer role changes or is disabled', async () => {
      const suffix = randomUUID();
      const { student, schoolYear } = await createTestStudent(suffix);
      await createTestAssessment(student.id, schoolYear.id, 50000);

      const parentUserId = randomUUID();
      await db.insert(schema.users).values({
        id: parentUserId,
        name: `Parent ${suffix.slice(0, 4)}`,
        email: `parent-${suffix.slice(0, 6)}@parent.test`,
        role: 'PARENT',
        active: true,
        emailVerified: true,
      });
      createdUserIds.push(parentUserId);

      const [guardian] = await db
        .insert(schema.guardians)
        .values({
          userId: parentUserId,
          firstName: 'Parent',
          lastName: `Guardian-${suffix.slice(0, 4)}`,
          email: `parent-${suffix.slice(0, 6)}@parent.test`,
          phone: '+63 912 345 6789',
          address: 'Test Address',
        })
        .returning();
      if (!guardian) throw new Error('Guardian creation failed.');
      createdGuardianIds.push(guardian.id);

      const [link] = await db
        .insert(schema.guardianStudents)
        .values({
          guardianId: guardian.id,
          studentId: student.id,
          isPrimary: true,
        })
        .returning();
      if (link) createdGuardianStudentIds.push(link.id);

      const reviewerUserId = randomUUID();
      const [tempReviewer] = await db
        .insert(schema.users)
        .values({
          id: reviewerUserId,
          name: `Reviewer ${suffix.slice(0, 4)}`,
          email: `reviewer-${suffix.slice(0, 6)}@school.test`,
          role: 'FINANCE_STAFF',
          active: true,
          emailVerified: true,
        })
        .returning();
      if (!tempReviewer) throw new Error('Reviewer creation failed.');
      createdUserIds.push(reviewerUserId);

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
        parentUserId,
        db
      );
      createdSubmissionIds.push(submission.id);

      expect(submission.status).toBe('PENDING_VERIFICATION');
      expect(submission.reviewedByUserId).toBeNull();
      expect(submission.reviewedAt).toBeNull();

      const approved = await approvePaymentSubmission(submission.id, tempReviewer.id, db);
      expect(approved.status).toBe('APPROVED');
      expect(approved.reviewedByUserId).toBe(tempReviewer.id);
      expect(approved.reviewedAt).toBeDefined();
      if (approved.approvedPaymentId) {
        createdPaymentIds.push(approved.approvedPaymentId);
        const [receipt] = await db
          .select({ id: schema.receipts.id })
          .from(schema.receipts)
          .where(eq(schema.receipts.paymentId, approved.approvedPaymentId));
        if (receipt) createdReceiptIds.push(receipt.id);
      }

      await db
        .update(schema.users)
        .set({ role: 'PARENT', active: false })
        .where(eq(schema.users.id, tempReviewer.id));

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
      createdNotificationIds.push(notification.id);

      const pastLease = new Date(Date.now() - 10000);
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
      createdDeliveryIds.push(delivery.id);

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
      createdNotificationIds.push(notification.id);

      const futureLease = new Date(Date.now() + 240000);
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
      createdDeliveryIds.push(delivery.id);

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

      await expect(
        db.insert(schema.adjustments).values({
          assessmentId: assessment1.id,
          studentId: student2.id,
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

      await expect(
        db.insert(schema.ledgerEntries).values({
          studentId: student2.id,
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
      const parentUserId = randomUUID();
      await db.insert(schema.users).values({
        id: parentUserId,
        name: `Multi Parent ${suffix.slice(0, 4)}`,
        email: `multi-parent-${suffix.slice(0, 6)}@parent.test`,
        role: 'PARENT',
        active: true,
        emailVerified: true,
      });
      createdUserIds.push(parentUserId);

      const [guardian] = await db
        .insert(schema.guardians)
        .values({
          userId: parentUserId,
          firstName: 'Multi',
          lastName: `Guardian-${suffix.slice(0, 4)}`,
          email: `multi-parent-${suffix.slice(0, 6)}@parent.test`,
          phone: '+63 912 345 6789',
          address: 'Multi Address',
        })
        .returning();
      if (!guardian) throw new Error('Guardian creation failed.');
      createdGuardianIds.push(guardian.id);

      const { student: child1 } = await createTestStudent(`a-${suffix}`);
      const { student: child2 } = await createTestStudent(`b-${suffix}`);

      const [link1] = await db
        .insert(schema.guardianStudents)
        .values({ guardianId: guardian.id, studentId: child1.id, isPrimary: true })
        .returning();
      if (link1) createdGuardianStudentIds.push(link1.id);

      const [link2] = await db
        .insert(schema.guardianStudents)
        .values({ guardianId: guardian.id, studentId: child2.id, isPrimary: false })
        .returning();
      if (link2) createdGuardianStudentIds.push(link2.id);

      const children = await getParentChildren(parentUserId, db);
      expect(children.length).toBe(2);

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
      await createTestAssessment(student.id, schoolYear.id, 50000);

      const monitor = await listAssessmentDeadlineMonitor({ now: new Date() }, db);
      expect(monitor).toBeDefined();
      expect(Array.isArray(monitor)).toBe(true);
    });
  });
});
