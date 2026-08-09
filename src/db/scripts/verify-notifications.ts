import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../index';
import * as schema from '../schema';
import {
  createFeeCategory,
  createFeeStructure,
  createGuardian,
  createStudent,
  linkGuardianStudent,
} from '../../server/services/students-fees.service';
import { AssessmentService } from '../../server/services/assessment.service';
import {
  MockPaymentGateway,
  processMockCallback,
} from '../../server/services/payment-gateway.service';
import { getPayment, PaymentService } from '../../server/services/payment.service';
import {
  enqueueNotification,
  NotificationService,
  type EmailProvider,
  type EmailMessage,
} from '../../server/services/notification.service';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FailingEmailProvider implements EmailProvider {
  readonly channel = 'EMAIL' as const;

  async send(_message: EmailMessage): Promise<{ providerMessageId?: string | null }> {
    throw new Error('Intentional Phase 9 provider failure.');
  }
}

async function notificationRows(entityId: string, db: ReturnType<typeof getDb>) {
  return db
    .select({
      id: schema.notifications.id,
      type: schema.notifications.type,
      deliveryStatus: schema.notificationDeliveries.status,
      attemptCount: schema.notificationDeliveries.attemptCount,
      deliveryChannel: schema.notificationDeliveries.channel,
    })
    .from(schema.notifications)
    .leftJoin(
      schema.notificationDeliveries,
      eq(schema.notificationDeliveries.notificationId, schema.notifications.id)
    )
    .where(eq(schema.notifications.entityId, entityId));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for notification verification.');

  const db = getDb(databaseUrl);
  const suffix = String(Date.now());
  const createdStudentIds: string[] = [];
  const createdGuardianIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdStructureIds: string[] = [];
  const createdAssessmentIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdCheckoutIds: string[] = [];
  const notificationEntityIds = new Set<string>();

  try {
    const [schoolYear] = await db
      .select({ id: schema.schoolYears.id })
      .from(schema.schoolYears)
      .where(eq(schema.schoolYears.status, 'ACTIVE'))
      .limit(1);
    const [gradeLevel] = await db
      .select({ id: schema.gradeLevels.id })
      .from(schema.gradeLevels)
      .orderBy(schema.gradeLevels.displayOrder)
      .limit(1);
    const users = await db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(
        inArray(schema.users.email, [
          'admin@demo.school',
          'finance@demo.school',
          'parent@demo.school',
          'student@demo.school',
        ])
      );
    const adminUser = users.find((user) => user.email === 'admin@demo.school');
    const financeUser = users.find((user) => user.email === 'finance@demo.school');
    const parentUser = users.find((user) => user.email === 'parent@demo.school');
    const studentUser = users.find((user) => user.email === 'student@demo.school');
    assert(schoolYear, 'An active school year is required.');
    assert(gradeLevel, 'A grade level is required.');
    assert(
      adminUser && financeUser && parentUser && studentUser,
      'The four demo users are required.'
    );

    const category = await createFeeCategory(
      {
        name: `Phase Nine Tuition ${suffix}`,
        code: `P9-TUITION-${suffix}`,
        description: 'Phase 9 notification verification fixture',
        status: 'ACTIVE',
      },
      db
    );
    createdCategoryIds.push(category.id);

    const structure = await createFeeStructure(
      {
        schoolYearId: schoolYear.id,
        gradeLevelId: gradeLevel.id,
        assessmentPeriod: 'ANNUAL',
        name: `Phase Nine Annual ${suffix}`,
        status: 'ACTIVE',
        items: [{ feeCategoryId: category.id, name: 'Phase Nine tuition', amountCentavos: 100000 }],
      },
      db
    );
    createdStructureIds.push(structure.id);

    const student = await createStudent(
      {
        studentNumber: `VERIFY-P9-${suffix}`,
        firstName: 'Phase Nine',
        lastName: 'Notification Student',
        email: `phase-nine-student-${suffix}@example.com`,
        userId: studentUser.id,
        gradeLevelId: gradeLevel.id,
        sectionId: null,
        schoolYearId: schoolYear.id,
        status: 'ACTIVE',
      },
      db
    );
    createdStudentIds.push(student.id);

    const guardian = await createGuardian(
      {
        firstName: 'Phase Nine',
        lastName: 'Notification Parent',
        email: `phase-nine-parent-${suffix}@example.com`,
        phone: '+63 900 000 0000',
        relationship: 'Parent',
        address: 'Fictional Phase 9 verification address',
        userId: parentUser.id,
      },
      db
    );
    createdGuardianIds.push(guardian.id);
    await linkGuardianStudent(
      { guardianId: guardian.id, studentId: student.id, isPrimary: true },
      db
    );

    const assessment = await AssessmentService.generateAssessment(
      { studentId: student.id, feeStructureId: structure.id, actorUserId: adminUser.id },
      db
    );
    createdAssessmentIds.push(assessment.id);
    notificationEntityIds.add(assessment.id);
    const assessmentNotifications = await notificationRows(assessment.id, db);
    assert(
      assessmentNotifications.filter((row) => row.type === 'ASSESSMENT_POSTED').length === 2,
      'Assessment posting did not create one notification per linked account.'
    );
    assert(
      assessmentNotifications.every((row) => row.deliveryStatus === 'SENT'),
      'Console provider did not record assessment notification delivery.'
    );

    const failingProvider = new FailingEmailProvider();
    const paymentInput = {
      studentId: student.id,
      amountCentavos: 40000,
      paymentMethod: 'CASH' as const,
      referenceNumber: `P9-CASH-${suffix}`,
      idempotencyKey: `phase-nine-payment-${suffix}`,
      processedByUserId: financeUser.id,
      notificationProvider: failingProvider,
    };
    const payment = await PaymentService.recordPayment(paymentInput, db);
    createdPaymentIds.push(payment.id);
    assert(payment.status === 'POSTED', 'Payment did not succeed when the provider failed.');
    assert(payment.receipt?.id, 'Successful payment did not create a receipt.');
    notificationEntityIds.add(payment.id);
    notificationEntityIds.add(payment.receipt.id);

    const paymentNotifications = await notificationRows(payment.id, db);
    const receiptNotifications = await notificationRows(payment.receipt.id, db);
    assert(
      paymentNotifications.filter((row) => row.type === 'PAYMENT_SUCCESSFUL').length === 2,
      'Successful payment did not create one notification per linked account.'
    );
    assert(
      receiptNotifications.filter((row) => row.type === 'RECEIPT_AVAILABLE').length === 2,
      'Receipt availability did not create one notification per linked account.'
    );
    assert(
      paymentNotifications.every(
        (row) => row.deliveryChannel === 'EMAIL' && row.deliveryStatus === 'PENDING'
      ),
      'Provider failures were not recorded as pending retryable email deliveries.'
    );

    const failedDelivery = paymentNotifications.find((row) => row.type === 'PAYMENT_SUCCESSFUL');
    assert(failedDelivery, 'A payment notification delivery was not persisted.');
    await NotificationService.retryNotification(failedDelivery.id, db, failingProvider);
    await NotificationService.retryNotification(failedDelivery.id, db, failingProvider);
    const exhaustedDelivery = (await notificationRows(payment.id, db)).find(
      (row) => row.id === failedDelivery.id
    );
    assert(
      exhaustedDelivery?.deliveryStatus === 'FAILED' && exhaustedDelivery.attemptCount === 3,
      'Notification failure retries did not reach the terminal failed state.'
    );

    await PaymentService.recordPayment(paymentInput, db);
    const afterDuplicatePayment = (await notificationRows(payment.id, db)).find(
      (row) => row.id === failedDelivery.id
    );
    assert(
      afterDuplicatePayment?.attemptCount === 3,
      'Duplicate payment submission retried or duplicated notification delivery.'
    );

    const reversal = await PaymentService.reversePayment(
      {
        paymentId: payment.id,
        reason: 'Phase 9 notification verification reversal',
        reversedByUserId: adminUser.id,
      },
      db
    );
    assert(reversal.paymentStatus === 'REVERSED', 'Payment reversal did not complete.');
    const reversalNotifications = await notificationRows(payment.id, db);
    assert(
      reversalNotifications.filter((row) => row.type === 'PAYMENT_REVERSED').length === 2,
      'Payment reversal did not create one notification per linked account.'
    );

    const gateway = new MockPaymentGateway(db);
    const checkout = await gateway.createCheckout({
      studentId: student.id,
      amountCentavos: 30000,
      paymentChannel: 'GCash',
      idempotencyKey: `phase-nine-checkout-${suffix}`,
      parentUserId: parentUser.id,
    });
    createdCheckoutIds.push(checkout.checkoutId);
    const callbackInput = {
      paymentReference: checkout.paymentReference,
      eventId: `phase-nine-event-${suffix}`,
      idempotencyKey: `phase-nine-callback-${suffix}`,
      status: 'SUCCESS' as const,
    };
    const callback = await processMockCallback(callbackInput, db);
    assert(callback.paymentId, 'Successful mock callback did not create a payment.');
    createdPaymentIds.push(callback.paymentId);
    const onlinePayment = await getPayment(callback.paymentId, db);
    assert(onlinePayment.receipt?.id, 'Successful mock callback did not create a receipt.');
    notificationEntityIds.add(callback.paymentId);
    notificationEntityIds.add(onlinePayment.receipt.id);
    const onlineNotificationCount =
      (await notificationRows(callback.paymentId, db)).length +
      (await notificationRows(onlinePayment.receipt.id, db)).length;
    const replay = await processMockCallback(callbackInput, db);
    assert(
      replay.isAlreadyProcessed,
      'Duplicate mock callback was not identified as already processed.'
    );
    const replayNotificationCount =
      (await notificationRows(callback.paymentId, db)).length +
      (await notificationRows(onlinePayment.receipt.id, db)).length;
    assert(
      replayNotificationCount === onlineNotificationCount,
      'Duplicate mock callback created duplicate notification records.'
    );

    console.log(
      'Notifications contract verified: persisted assessment, payment, receipt, and reversal history; console fallback; Resend-provider failure recording and retries; financial success despite delivery failure; and duplicate callback/payment notification idempotency.'
    );
  } finally {
    const entityIds = [...notificationEntityIds];
    if (entityIds.length > 0) {
      const notificationIds = await db
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(inArray(schema.notifications.entityId, entityIds));
      if (notificationIds.length > 0) {
        const ids = notificationIds.map((row) => row.id);
        await db
          .delete(schema.notificationDeliveries)
          .where(inArray(schema.notificationDeliveries.notificationId, ids));
        await db.delete(schema.notifications).where(inArray(schema.notifications.id, ids));
      }
    }
    if (createdCheckoutIds.length > 0) {
      await db
        .delete(schema.mockPaymentCallbackEvents)
        .where(inArray(schema.mockPaymentCallbackEvents.checkoutId, createdCheckoutIds));
      await db
        .delete(schema.mockPaymentCheckouts)
        .where(inArray(schema.mockPaymentCheckouts.id, createdCheckoutIds));
    }
    if (createdPaymentIds.length > 0) {
      await db
        .delete(schema.paymentReversals)
        .where(inArray(schema.paymentReversals.paymentId, createdPaymentIds));
      await db
        .delete(schema.paymentAllocations)
        .where(inArray(schema.paymentAllocations.paymentId, createdPaymentIds));
      await db.delete(schema.receipts).where(inArray(schema.receipts.paymentId, createdPaymentIds));
      await db.delete(schema.payments).where(inArray(schema.payments.id, createdPaymentIds));
    }
    if (createdAssessmentIds.length > 0) {
      await db
        .delete(schema.ledgerEntries)
        .where(inArray(schema.ledgerEntries.assessmentId, createdAssessmentIds));
      await db
        .delete(schema.assessmentItems)
        .where(inArray(schema.assessmentItems.assessmentId, createdAssessmentIds));
      await db
        .delete(schema.studentAssessments)
        .where(inArray(schema.studentAssessments.id, createdAssessmentIds));
    }
    if (createdGuardianIds.length > 0) {
      await db
        .delete(schema.guardianStudents)
        .where(inArray(schema.guardianStudents.guardianId, createdGuardianIds));
      await db.delete(schema.guardians).where(inArray(schema.guardians.id, createdGuardianIds));
    }
    if (createdStudentIds.length > 0) {
      await db.delete(schema.students).where(inArray(schema.students.id, createdStudentIds));
    }
    if (createdStructureIds.length > 0) {
      await db
        .delete(schema.feeStructureItems)
        .where(inArray(schema.feeStructureItems.feeStructureId, createdStructureIds));
      await db
        .delete(schema.feeStructures)
        .where(inArray(schema.feeStructures.id, createdStructureIds));
    }
    if (createdCategoryIds.length > 0) {
      await db
        .delete(schema.feeCategories)
        .where(inArray(schema.feeCategories.id, createdCategoryIds));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Notifications verification failed:', error);
    process.exit(1);
  });
