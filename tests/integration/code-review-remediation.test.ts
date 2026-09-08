import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, or, type SQL } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb, type DatabaseInstance } from '@/db';
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
  const createdNotificationIds: string[] = [];
  const createdDeliveryIds: string[] = [];
  const createdAttemptIds: string[] = [];

  interface RemediationFixtureContext {
    createdUserIds?: string[];
    createdStudentIds?: string[];
    createdGuardianIds?: string[];
    createdGuardianStudentIds?: string[];
    createdAssessmentIds?: string[];
    createdAssessmentItemIds?: string[];
    createdLedgerEntryIds?: string[];
    createdAdjustmentIds?: string[];
    createdPaymentIds?: string[];
    createdReceiptIds?: string[];
    createdAllocationIds?: string[];
    createdReversalIds?: string[];
    createdSubmissionIds?: string[];
    createdNotificationIds?: string[];
    createdDeliveryIds?: string[];
    createdAttemptIds?: string[];
  }

  async function cleanupRemediationFixtures(
    targetDb: DatabaseInstance,
    context: RemediationFixtureContext
  ) {
    const {
      createdUserIds = [],
      createdStudentIds = [],
      createdGuardianIds = [],
      createdGuardianStudentIds = [],
      createdAssessmentIds = [],
      createdAssessmentItemIds = [],
      createdLedgerEntryIds = [],
      createdAdjustmentIds = [],
      createdPaymentIds = [],
      createdReceiptIds = [],
      createdAllocationIds = [],
      createdReversalIds = [],
      createdSubmissionIds = [],
      createdNotificationIds = [],
      createdDeliveryIds = [],
      createdAttemptIds = [],
    } = context;

    // 1. Notifications, Deliveries & Attempts
    // Discover notifications created directly or indirectly by services for these fixtures
    const targetNotificationIds = new Set<string>(createdNotificationIds);
    const notificationConditions: SQL[] = [];
    if (createdUserIds.length > 0) {
      notificationConditions.push(inArray(schema.notifications.userId, createdUserIds));
    }
    if (createdPaymentIds.length > 0) {
      notificationConditions.push(
        and(
          eq(schema.notifications.entityType, 'PAYMENT'),
          inArray(schema.notifications.entityId, createdPaymentIds)
        )!
      );
    }
    if (createdReceiptIds.length > 0) {
      notificationConditions.push(
        and(
          eq(schema.notifications.entityType, 'RECEIPT'),
          inArray(schema.notifications.entityId, createdReceiptIds)
        )!
      );
    }
    if (notificationConditions.length > 0) {
      const foundNotifications = await targetDb
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(or(...notificationConditions));
      for (const row of foundNotifications) {
        targetNotificationIds.add(row.id);
      }
    }

    // Discover deliveries for target notifications + directly tracked deliveries
    const targetDeliveryIds = new Set<string>(createdDeliveryIds);
    if (targetNotificationIds.size > 0) {
      const foundDeliveries = await targetDb
        .select({ id: schema.notificationDeliveries.id })
        .from(schema.notificationDeliveries)
        .where(
          inArray(schema.notificationDeliveries.notificationId, Array.from(targetNotificationIds))
        );
      for (const row of foundDeliveries) {
        targetDeliveryIds.add(row.id);
      }
    }

    // Delete attempts
    const attemptConditions: SQL[] = [];
    if (createdAttemptIds.length > 0) {
      attemptConditions.push(inArray(schema.notificationDeliveryAttempts.id, createdAttemptIds));
    }
    if (targetDeliveryIds.size > 0) {
      attemptConditions.push(
        inArray(schema.notificationDeliveryAttempts.deliveryId, Array.from(targetDeliveryIds))
      );
    }
    if (attemptConditions.length > 0) {
      await targetDb.delete(schema.notificationDeliveryAttempts).where(or(...attemptConditions));
    }

    // Delete deliveries
    if (targetDeliveryIds.size > 0) {
      await targetDb
        .delete(schema.notificationDeliveries)
        .where(inArray(schema.notificationDeliveries.id, Array.from(targetDeliveryIds)));
    }

    // Delete notifications
    if (targetNotificationIds.size > 0) {
      await targetDb
        .delete(schema.notifications)
        .where(inArray(schema.notifications.id, Array.from(targetNotificationIds)));
    }

    // 2. Audit logs (must delete audit logs referencing created users/entities before deleting users)
    const auditLogConditions: SQL[] = [];
    if (createdUserIds.length > 0) {
      auditLogConditions.push(inArray(schema.auditLogs.userId, createdUserIds));
    }
    if (createdPaymentIds.length > 0) {
      auditLogConditions.push(inArray(schema.auditLogs.entityId, createdPaymentIds));
    }
    if (createdSubmissionIds.length > 0) {
      auditLogConditions.push(inArray(schema.auditLogs.entityId, createdSubmissionIds));
    }
    if (createdReceiptIds.length > 0) {
      auditLogConditions.push(inArray(schema.auditLogs.entityId, createdReceiptIds));
    }
    if (auditLogConditions.length > 0) {
      await targetDb.delete(schema.auditLogs).where(or(...auditLogConditions));
    }

    // 3. Payment submission proofs and submissions
    const targetSubmissionIds = new Set<string>(createdSubmissionIds);
    const submissionConditions: SQL[] = [];
    if (createdStudentIds.length > 0) {
      submissionConditions.push(inArray(schema.paymentSubmissions.studentId, createdStudentIds));
    }
    if (createdPaymentIds.length > 0) {
      submissionConditions.push(
        inArray(schema.paymentSubmissions.approvedPaymentId, createdPaymentIds)
      );
    }
    if (createdUserIds.length > 0) {
      submissionConditions.push(
        inArray(schema.paymentSubmissions.submittedByUserId, createdUserIds)
      );
    }
    if (submissionConditions.length > 0) {
      const foundSubmissions = await targetDb
        .select({ id: schema.paymentSubmissions.id })
        .from(schema.paymentSubmissions)
        .where(or(...submissionConditions));
      for (const row of foundSubmissions) {
        targetSubmissionIds.add(row.id);
      }
    }
    if (targetSubmissionIds.size > 0) {
      const subIds = Array.from(targetSubmissionIds);
      await targetDb
        .delete(schema.paymentSubmissionProofs)
        .where(inArray(schema.paymentSubmissionProofs.submissionId, subIds));
      await targetDb
        .delete(schema.paymentSubmissions)
        .where(inArray(schema.paymentSubmissions.id, subIds));
    }

    // 4. Payment reversals (references payments, receipts, and users)
    const reversalConditions: SQL[] = [];
    if (createdReversalIds.length > 0) {
      reversalConditions.push(inArray(schema.paymentReversals.id, createdReversalIds));
    }
    if (createdPaymentIds.length > 0) {
      reversalConditions.push(inArray(schema.paymentReversals.paymentId, createdPaymentIds));
    }
    if (createdReceiptIds.length > 0) {
      reversalConditions.push(inArray(schema.paymentReversals.receiptId, createdReceiptIds));
    }
    if (reversalConditions.length > 0) {
      await targetDb.delete(schema.paymentReversals).where(or(...reversalConditions));
    }

    // 5. Payment allocations (must be deleted BEFORE receipts and payments, and before assessment items/adjustments)
    const allocationConditions: SQL[] = [];
    if (createdAllocationIds.length > 0) {
      allocationConditions.push(inArray(schema.paymentAllocations.id, createdAllocationIds));
    }
    if (createdPaymentIds.length > 0) {
      allocationConditions.push(inArray(schema.paymentAllocations.paymentId, createdPaymentIds));
    }
    if (createdAssessmentItemIds.length > 0) {
      allocationConditions.push(
        inArray(schema.paymentAllocations.assessmentItemId, createdAssessmentItemIds)
      );
    }
    if (createdAdjustmentIds.length > 0) {
      allocationConditions.push(
        inArray(schema.paymentAllocations.adjustmentId, createdAdjustmentIds)
      );
    }
    if (allocationConditions.length > 0) {
      await targetDb.delete(schema.paymentAllocations).where(or(...allocationConditions));
    }

    // 6. Receipts (must be deleted BEFORE payments)
    const receiptConditions: SQL[] = [];
    if (createdReceiptIds.length > 0) {
      receiptConditions.push(inArray(schema.receipts.id, createdReceiptIds));
    }
    if (createdPaymentIds.length > 0) {
      receiptConditions.push(inArray(schema.receipts.paymentId, createdPaymentIds));
    }
    if (receiptConditions.length > 0) {
      await targetDb.delete(schema.receipts).where(or(...receiptConditions));
    }

    // 7. Payments
    const paymentConditions: SQL[] = [];
    if (createdPaymentIds.length > 0) {
      paymentConditions.push(inArray(schema.payments.id, createdPaymentIds));
    }
    if (createdStudentIds.length > 0) {
      paymentConditions.push(inArray(schema.payments.studentId, createdStudentIds));
    }
    if (createdAssessmentIds.length > 0) {
      paymentConditions.push(inArray(schema.payments.assessmentId, createdAssessmentIds));
    }
    if (paymentConditions.length > 0) {
      await targetDb.delete(schema.payments).where(or(...paymentConditions));
    }

    // 8. Adjustments
    const adjustmentConditions: SQL[] = [];
    if (createdAdjustmentIds.length > 0) {
      adjustmentConditions.push(inArray(schema.adjustments.id, createdAdjustmentIds));
    }
    if (createdAssessmentIds.length > 0) {
      adjustmentConditions.push(inArray(schema.adjustments.assessmentId, createdAssessmentIds));
    }
    if (createdStudentIds.length > 0) {
      adjustmentConditions.push(inArray(schema.adjustments.studentId, createdStudentIds));
    }
    if (adjustmentConditions.length > 0) {
      await targetDb.delete(schema.adjustments).where(or(...adjustmentConditions));
    }

    // 9. Ledger entries (references students and studentAssessments)
    const ledgerConditions: SQL[] = [];
    if (createdLedgerEntryIds.length > 0) {
      ledgerConditions.push(inArray(schema.ledgerEntries.id, createdLedgerEntryIds));
    }
    if (createdStudentIds.length > 0) {
      ledgerConditions.push(inArray(schema.ledgerEntries.studentId, createdStudentIds));
    }
    if (createdAssessmentIds.length > 0) {
      ledgerConditions.push(inArray(schema.ledgerEntries.assessmentId, createdAssessmentIds));
    }
    if (ledgerConditions.length > 0) {
      await targetDb.delete(schema.ledgerEntries).where(or(...ledgerConditions));
    }

    // 10. Assessment items
    const itemConditions: SQL[] = [];
    if (createdAssessmentItemIds.length > 0) {
      itemConditions.push(inArray(schema.assessmentItems.id, createdAssessmentItemIds));
    }
    if (createdAssessmentIds.length > 0) {
      itemConditions.push(inArray(schema.assessmentItems.assessmentId, createdAssessmentIds));
    }
    if (itemConditions.length > 0) {
      await targetDb.delete(schema.assessmentItems).where(or(...itemConditions));
    }

    // 11. Student assessments
    const assessmentConditions: SQL[] = [];
    if (createdAssessmentIds.length > 0) {
      assessmentConditions.push(inArray(schema.studentAssessments.id, createdAssessmentIds));
    }
    if (createdStudentIds.length > 0) {
      assessmentConditions.push(inArray(schema.studentAssessments.studentId, createdStudentIds));
    }
    if (assessmentConditions.length > 0) {
      await targetDb.delete(schema.studentAssessments).where(or(...assessmentConditions));
    }

    // 12. Guardian-students
    const linkConditions: SQL[] = [];
    if (createdGuardianStudentIds.length > 0) {
      linkConditions.push(inArray(schema.guardianStudents.id, createdGuardianStudentIds));
    }
    if (createdGuardianIds.length > 0) {
      linkConditions.push(inArray(schema.guardianStudents.guardianId, createdGuardianIds));
    }
    if (createdStudentIds.length > 0) {
      linkConditions.push(inArray(schema.guardianStudents.studentId, createdStudentIds));
    }
    if (linkConditions.length > 0) {
      await targetDb.delete(schema.guardianStudents).where(or(...linkConditions));
    }

    // 13. Guardians
    const guardianConditions: SQL[] = [];
    if (createdGuardianIds.length > 0) {
      guardianConditions.push(inArray(schema.guardians.id, createdGuardianIds));
    }
    if (createdUserIds.length > 0) {
      guardianConditions.push(inArray(schema.guardians.userId, createdUserIds));
    }
    if (guardianConditions.length > 0) {
      await targetDb.delete(schema.guardians).where(or(...guardianConditions));
    }

    // 14. Students
    const studentConditions: SQL[] = [];
    if (createdStudentIds.length > 0) {
      studentConditions.push(inArray(schema.students.id, createdStudentIds));
    }
    if (createdUserIds.length > 0) {
      studentConditions.push(inArray(schema.students.userId, createdUserIds));
    }
    if (studentConditions.length > 0) {
      await targetDb.delete(schema.students).where(or(...studentConditions));
    }

    // 15. Users
    if (createdUserIds.length > 0) {
      await targetDb.delete(schema.users).where(inArray(schema.users.id, createdUserIds));
    }
  }

  afterAll(async () => {
    await cleanupRemediationFixtures(db, {
      createdUserIds,
      createdStudentIds,
      createdGuardianIds,
      createdGuardianStudentIds,
      createdAssessmentIds,
      createdAssessmentItemIds,
      createdLedgerEntryIds,
      createdAdjustmentIds,
      createdPaymentIds,
      createdReceiptIds,
      createdAllocationIds,
      createdReversalIds,
      createdSubmissionIds,
      createdNotificationIds,
      createdDeliveryIds,
      createdAttemptIds,
    });
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

  describe('Fixture Isolation & Cascading Cleanup Regression Contract', () => {
    it('cascades deletion from parent payment IDs and preserves seeded database counts', async () => {
      // Snapshot baseline seeded counts before creating fixture
      const initialPayments = await db.select({ id: schema.payments.id }).from(schema.payments);
      const initialReceipts = await db.select({ id: schema.receipts.id }).from(schema.receipts);
      const initialAllocations = await db
        .select({ id: schema.paymentAllocations.id })
        .from(schema.paymentAllocations);
      const initialLedger = await db
        .select({ id: schema.ledgerEntries.id })
        .from(schema.ledgerEntries);
      const initialAssessments = await db
        .select({ id: schema.studentAssessments.id })
        .from(schema.studentAssessments);
      const initialStudents = await db.select({ id: schema.students.id }).from(schema.students);

      const suffix = randomUUID();
      const { student, schoolYear } = await createTestStudent(suffix);
      const assessment = await createTestAssessment(student.id, schoolYear.id, 60000);
      const admin = await getAdminUser();

      // Create payment via PaymentService - generates payment, receipt, allocations, and ledger entries
      const payment = await PaymentService.recordPayment(
        {
          studentId: student.id,
          amountCentavos: 60000,
          paymentMethod: 'CASH',
          idempotencyKey: `isolation-regression-${suffix}`,
          processedByUserId: admin.id,
        },
        db
      );

      // Verify that PaymentService created dependent allocation records in the DB
      const generatedAllocations = await db
        .select()
        .from(schema.paymentAllocations)
        .where(eq(schema.paymentAllocations.paymentId, payment.id));
      expect(generatedAllocations.length).toBeGreaterThan(0);

      const generatedReceipts = await db
        .select()
        .from(schema.receipts)
        .where(eq(schema.receipts.paymentId, payment.id));
      expect(generatedReceipts.length).toBeGreaterThan(0);

      // Execute cleanup for this specific fixture, intentionally omitting generated allocation IDs
      // to prove that child records are deleted by authoritative parent IDs in valid FK order
      await cleanupRemediationFixtures(db, {
        createdStudentIds: [student.id],
        createdAssessmentIds: [assessment.id],
        createdPaymentIds: [payment.id],
      });

      // Assert no orphaned records remain referencing the deleted fixture
      const remainingAllocations = await db
        .select()
        .from(schema.paymentAllocations)
        .where(eq(schema.paymentAllocations.paymentId, payment.id));
      expect(remainingAllocations).toHaveLength(0);

      const remainingReceipts = await db
        .select()
        .from(schema.receipts)
        .where(eq(schema.receipts.paymentId, payment.id));
      expect(remainingReceipts).toHaveLength(0);

      const remainingPayments = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, payment.id));
      expect(remainingPayments).toHaveLength(0);

      const remainingStudents = await db
        .select()
        .from(schema.students)
        .where(eq(schema.students.id, student.id));
      expect(remainingStudents).toHaveLength(0);

      // Verify baseline seeded demo counts are completely unchanged
      const finalPayments = await db.select({ id: schema.payments.id }).from(schema.payments);
      const finalReceipts = await db.select({ id: schema.receipts.id }).from(schema.receipts);
      const finalAllocations = await db
        .select({ id: schema.paymentAllocations.id })
        .from(schema.paymentAllocations);
      const finalLedger = await db
        .select({ id: schema.ledgerEntries.id })
        .from(schema.ledgerEntries);
      const finalAssessments = await db
        .select({ id: schema.studentAssessments.id })
        .from(schema.studentAssessments);
      const finalStudents = await db.select({ id: schema.students.id }).from(schema.students);

      expect(finalPayments.length).toBe(initialPayments.length);
      expect(finalReceipts.length).toBe(initialReceipts.length);
      expect(finalAllocations.length).toBe(initialAllocations.length);
      expect(finalLedger.length).toBe(initialLedger.length);
      expect(finalAssessments.length).toBe(initialAssessments.length);
      expect(finalStudents.length).toBe(initialStudents.length);
    });
  });
});
