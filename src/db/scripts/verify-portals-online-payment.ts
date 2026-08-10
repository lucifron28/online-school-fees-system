import dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { count, eq, inArray } from 'drizzle-orm';
import { getDb } from '../index';
import * as schema from '../schema';
import { logSanitizedError } from '../../server/logging';
import {
  createFeeCategory,
  createFeeStructure,
  createGuardian,
  createStudent,
  linkGuardianStudent,
} from '../../server/services/students-fees.service';
import { AssessmentService, getStudentLedger } from '../../server/services/assessment.service';
import { getPayment } from '../../server/services/payment.service';
import {
  getMockCheckout,
  MockPaymentGateway,
  processMockCallback,
} from '../../server/services/payment-gateway.service';
import {
  getParentChildren,
  getStudentAccountForUser,
  listOwnedPayments,
} from '../../server/services/portal.service';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function assertCheck(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for portal and online-payment verification.');
  }

  const db = getDb(process.env.DATABASE_URL);
  const stamp = Date.now();
  const checks: string[] = [];
  const createdStudentIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdStructureIds: string[] = [];
  const createdAssessmentIds: string[] = [];
  const createdCheckoutIds: string[] = [];
  const createdGuardianIds: string[] = [];
  const createdUserIds: string[] = [];

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
  const users = await db
    .select({ id: schema.users.id, email: schema.users.email, role: schema.users.role })
    .from(schema.users)
    .where(
      inArray(schema.users.email, [
        'admin@demo.school',
        'parent@demo.school',
        'student@demo.school',
      ])
    );
  const adminUser = users.find((user) => user.email === 'admin@demo.school');
  const parentUser = users.find((user) => user.email === 'parent@demo.school');
  const studentUser = users.find((user) => user.email === 'student@demo.school');

  assertCheck(Boolean(activeSchoolYear[0]), 'Seed data must include an active school year.');
  assertCheck(Boolean(gradeLevel[0]), 'Seed data must include a grade level.');
  assertCheck(Boolean(adminUser), 'Seed data must include the demo admin account.');
  assertCheck(Boolean(parentUser), 'Seed data must include the demo parent account.');
  assertCheck(Boolean(studentUser), 'Seed data must include the demo student account.');

  try {
    const verificationStudentUserId = randomUUID();
    const [verificationStudentUser] = await db
      .insert(schema.users)
      .values({
        id: verificationStudentUserId,
        name: 'Portal verification student',
        email: `portal-student-${stamp}@example.com`,
        role: 'STUDENT',
        active: true,
        emailVerified: true,
      })
      .returning({ id: schema.users.id });
    if (!verificationStudentUser)
      throw new Error('Portal verification student account could not be created.');
    createdUserIds.push(verificationStudentUser.id);

    const verificationParentUserId = randomUUID();
    const [verificationParentUser] = await db
      .insert(schema.users)
      .values({
        id: verificationParentUserId,
        name: 'Portal verification parent',
        email: `portal-parent-${stamp}@example.com`,
        role: 'PARENT',
        active: true,
        emailVerified: true,
      })
      .returning({ id: schema.users.id });
    if (!verificationParentUser)
      throw new Error('Portal verification parent account could not be created.');
    createdUserIds.push(verificationParentUser.id);

    const tuitionCategory = await createFeeCategory(
      {
        name: `Phase Seven Tuition ${stamp}`,
        code: `PORTAL-TUITION-${stamp}`,
        description: 'Phase 7 portal verification category',
        status: 'ACTIVE',
      },
      db
    );
    const activitiesCategory = await createFeeCategory(
      {
        name: `Phase Seven Activities ${stamp}`,
        code: `PORTAL-ACTIVITIES-${stamp}`,
        description: 'Phase 7 portal verification category',
        status: 'ACTIVE',
      },
      db
    );
    createdCategoryIds.push(tuitionCategory.id, activitiesCategory.id);

    const structure = await createFeeStructure(
      {
        schoolYearId: activeSchoolYear[0].id,
        gradeLevelId: gradeLevel[0].id,
        assessmentPeriod: 'ANNUAL',
        name: `Phase Seven Annual ${stamp}`,
        status: 'ACTIVE',
        items: [
          { feeCategoryId: tuitionCategory.id, name: 'Tuition', amountCentavos: 120000 },
          { feeCategoryId: activitiesCategory.id, name: 'Activities', amountCentavos: 80000 },
        ],
      },
      db
    );
    createdStructureIds.push(structure.id);

    const linkedStudent = await createStudent(
      {
        studentNumber: `VERIFY-PORTAL-${stamp}`,
        firstName: 'Phase Seven',
        lastName: 'Linked Student',
        email: `phase-seven-linked-${stamp}@example.com`,
        userId: verificationStudentUser.id,
        gradeLevelId: gradeLevel[0].id,
        sectionId: null,
        schoolYearId: activeSchoolYear[0].id,
        status: 'ACTIVE',
      },
      db
    );
    createdStudentIds.push(linkedStudent.id);
    const unlinkedStudent = await createStudent(
      {
        studentNumber: `VERIFY-UNLINK-${stamp}`,
        firstName: 'Phase Seven',
        lastName: 'Unlinked Student',
        email: `phase-seven-unlinked-${stamp}@example.com`,
        userId: null,
        gradeLevelId: gradeLevel[0].id,
        sectionId: null,
        schoolYearId: activeSchoolYear[0].id,
        status: 'ACTIVE',
      },
      db
    );
    createdStudentIds.push(unlinkedStudent.id);

    const guardian = await createGuardian(
      {
        firstName: 'Phase Seven',
        lastName: 'Parent',
        email: `phase-seven-parent-${stamp}@example.com`,
        phone: '+63 900 000 0000',
        relationship: 'Parent',
        address: 'Fictional portal verification address',
        userId: verificationParentUser.id,
      },
      db
    );
    createdGuardianIds.push(guardian.id);
    await linkGuardianStudent(
      { guardianId: guardian.id, studentId: linkedStudent.id, isPrimary: true },
      db
    );

    const linkedAssessment = await AssessmentService.generateAssessment(
      {
        studentId: linkedStudent.id,
        feeStructureId: structure.id,
        actorUserId: adminUser!.id,
      },
      db
    );
    createdAssessmentIds.push(linkedAssessment.id);

    const parentChildren = await getParentChildren(verificationParentUser.id, db);
    assertCheck(
      parentChildren.length === 1,
      'Parent ownership query returned an unlinked student.'
    );
    assertCheck(
      parentChildren[0]?.studentId === linkedStudent.id &&
        parentChildren[0].outstandingBalanceCentavos === 200000,
      'Parent child summary did not use the linked student ledger.'
    );
    const parentAccount = await getStudentAccountForUser(
      verificationParentUser.id,
      'PARENT',
      linkedStudent.id,
      db
    );
    assertCheck(
      parentAccount.assessments.length === 1,
      'Parent account did not load posted assessment data.'
    );
    await expectRejected(
      () => getStudentAccountForUser(parentUser!.id, 'PARENT', unlinkedStudent.id, db),
      'Parent accessed an unlinked child.'
    );
    const studentAccount = await getStudentAccountForUser(
      verificationStudentUser.id,
      'STUDENT',
      undefined,
      db
    );
    assertCheck(
      studentAccount.student.studentId === linkedStudent.id,
      'Student account did not resolve through students.user_id.'
    );
    await expectRejected(
      () => getStudentAccountForUser(verificationStudentUser.id, 'STUDENT', unlinkedStudent.id, db),
      'Student accessed another student.'
    );
    checks.push('database-backed parent and student ownership');

    const gateway = new MockPaymentGateway(db);
    const checkoutInput = {
      studentId: linkedStudent.id,
      assessmentId: linkedAssessment.id,
      amountCentavos: 50000,
      paymentChannel: 'GCash' as const,
      idempotencyKey: `portal-checkout-${stamp}`,
      parentUserId: verificationParentUser.id,
    };
    const checkout = await gateway.createCheckout(checkoutInput);
    createdCheckoutIds.push(checkout.checkoutId);
    const checkoutReplay = await new MockPaymentGateway(db).createCheckout(checkoutInput);
    assertCheck(
      checkoutReplay.checkoutId === checkout.checkoutId,
      'Checkout replay created a duplicate.'
    );
    assertCheck(
      (
        await db
          .select({ id: schema.mockPaymentCheckouts.id })
          .from(schema.mockPaymentCheckouts)
          .where(eq(schema.mockPaymentCheckouts.idempotencyKey, checkoutInput.idempotencyKey))
      ).length === 1,
      'Checkout idempotency was not persisted.'
    );
    let checkoutConflictRejected = false;
    try {
      await gateway.createCheckout({ ...checkoutInput, amountCentavos: 50001 });
    } catch (error) {
      checkoutConflictRejected =
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        error.statusCode === 409;
    }
    assertCheck(
      checkoutConflictRejected,
      'Checkout idempotency accepted changed amount semantics.'
    );
    const checkoutChannel = (
      await db
        .select({ paymentChannel: schema.mockPaymentCheckouts.paymentChannel })
        .from(schema.mockPaymentCheckouts)
        .where(eq(schema.mockPaymentCheckouts.id, checkout.checkoutId))
    )[0];
    assertCheck(
      checkoutChannel?.paymentChannel === 'GCash',
      'Checkout payment channel was not persisted.'
    );
    const initialVerification = await new MockPaymentGateway(db).verifyPayment(
      checkout.paymentReference
    );
    assertCheck(initialVerification.status === 'PENDING', 'New checkout was not pending.');

    const pendingCallback = {
      paymentReference: checkout.paymentReference,
      eventId: `event-pending-${stamp}`,
      idempotencyKey: `callback-pending-${stamp}`,
      status: 'PENDING' as const,
    };
    await processMockCallback(pendingCallback, db);
    const afterPendingLedger = await getStudentLedger(linkedStudent.id, db);
    assertCheck(
      afterPendingLedger.balanceCentavos === 200000,
      'Pending callback changed the ledger.'
    );

    const successCallback = {
      paymentReference: checkout.paymentReference,
      eventId: `event-success-${stamp}`,
      idempotencyKey: `callback-success-${stamp}`,
      status: 'SUCCESS' as const,
    };
    const success = await processMockCallback(successCallback, db);
    assertCheck(
      success.verificationStatus === 'SUCCESS',
      'Successful callback did not complete checkout.'
    );
    assertCheck(Boolean(success.paymentId), 'Successful callback did not create a payment.');
    const onlinePayment = await getPayment(success.paymentId!, db);
    assertCheck(
      onlinePayment.paymentMethod === 'MOCK_ONLINE',
      'Online payment used the wrong method.'
    );
    assertCheck(
      onlinePayment.amountCentavos === 50000,
      'Callback trusted an incorrect client amount.'
    );
    assertCheck(
      onlinePayment.studentId === linkedStudent.id,
      'Callback trusted an incorrect client student.'
    );
    assertCheck(
      onlinePayment.receipt?.status === 'ACTIVE',
      'Successful online payment has no active receipt.'
    );
    const replay = await processMockCallback(successCallback, db);
    assertCheck(replay.isAlreadyProcessed, 'Duplicate callback was not detected.');
    await expectRejected(
      () =>
        processMockCallback(
          {
            ...successCallback,
            paymentReference: 'MOCK-unknown-reference',
            eventId: `event-unknown-${stamp}`,
            idempotencyKey: `callback-unknown-${stamp}`,
          },
          db
        ),
      'Callback accepted an unknown payment reference.'
    );
    await expectRejected(
      () =>
        processMockCallback({ ...successCallback, paymentReference: 'MOCK-foreign-reference' }, db),
      'Callback replay key was accepted for another checkout.'
    );
    assertCheck(
      (
        await db
          .select({ id: schema.payments.id })
          .from(schema.payments)
          .where(eq(schema.payments.studentId, linkedStudent.id))
      ).length === 1,
      'Duplicate callback created another payment.'
    );
    const restartVerification = await new MockPaymentGateway(db).verifyPayment(
      checkout.paymentReference
    );
    assertCheck(
      restartVerification.status === 'SUCCESS' && restartVerification.isAlreadyProcessed === true,
      'Mock payment state did not survive a new gateway instance.'
    );
    const parentPayments = await listOwnedPayments(verificationParentUser.id, 'PARENT', db);
    const studentPayments = await listOwnedPayments(verificationStudentUser.id, 'STUDENT', db);
    assertCheck(
      parentPayments.length === 1 && studentPayments.length === 1,
      'Portal payment lists lost ownership filtering.'
    );
    checks.push('persisted checkout, successful online payment, receipt, and server verification');

    const failedCheckout = await gateway.createCheckout({
      ...checkoutInput,
      amountCentavos: 10000,
      idempotencyKey: `portal-failed-${stamp}`,
    });
    createdCheckoutIds.push(failedCheckout.checkoutId);
    await processMockCallback(
      {
        paymentReference: failedCheckout.paymentReference,
        eventId: `event-failed-${stamp}`,
        idempotencyKey: `callback-failed-${stamp}`,
        status: 'FAILED',
      },
      db
    );
    const cancelledCheckout = await gateway.createCheckout({
      ...checkoutInput,
      amountCentavos: 10000,
      idempotencyKey: `portal-cancelled-${stamp}`,
    });
    createdCheckoutIds.push(cancelledCheckout.checkoutId);
    await processMockCallback(
      {
        paymentReference: cancelledCheckout.paymentReference,
        eventId: `event-cancelled-${stamp}`,
        idempotencyKey: `callback-cancelled-${stamp}`,
        status: 'CANCELLED',
      },
      db
    );
    const expiredCheckout = await gateway.createCheckout({
      ...checkoutInput,
      amountCentavos: 10000,
      idempotencyKey: `portal-expired-${stamp}`,
    });
    createdCheckoutIds.push(expiredCheckout.checkoutId);
    await db
      .update(schema.mockPaymentCheckouts)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.mockPaymentCheckouts.id, expiredCheckout.checkoutId));
    const expiredState = await getMockCheckout(expiredCheckout.paymentReference, db);
    assertCheck(
      expiredState.status === 'EXPIRED',
      'Expired checkout was not persisted as expired.'
    );
    const expiredCallback = await processMockCallback(
      {
        paymentReference: expiredCheckout.paymentReference,
        eventId: `event-expired-${stamp}`,
        idempotencyKey: `callback-expired-${stamp}`,
        status: 'SUCCESS',
      },
      db
    );
    assertCheck(
      expiredCallback.status === 'failed' && expiredCallback.paymentId === null,
      'Expired checkout callback created a payment.'
    );
    checks.push('checkout semantic conflicts and persisted expiration before callback');
    const finalLedger = await getStudentLedger(linkedStudent.id, db);
    assertCheck(
      finalLedger.balanceCentavos === 150000,
      'Failed or cancelled callback altered the ledger.'
    );
    const callbackCount = await db
      .select({ total: count() })
      .from(schema.mockPaymentCallbackEvents)
      .where(inArray(schema.mockPaymentCallbackEvents.checkoutId, createdCheckoutIds));
    assertCheck(
      Number(callbackCount[0]?.total ?? 0) === 5,
      'Callback events were not persisted exactly once.'
    );
    const checkoutRecord = await getMockCheckout(checkout.paymentReference, db);
    assertCheck(
      checkoutRecord.status === 'SUCCEEDED',
      'Persisted checkout status was not updated.'
    );
    checks.push('failed, cancelled, delayed, and duplicate callbacks without ledger corruption');
  } finally {
    const paymentRows =
      createdStudentIds.length > 0
        ? await db
            .select({ id: schema.payments.id })
            .from(schema.payments)
            .where(inArray(schema.payments.studentId, createdStudentIds))
        : [];
    const paymentIds = paymentRows.map((payment) => payment.id);
    const receiptRows =
      paymentIds.length > 0
        ? await db
            .select({ id: schema.receipts.id })
            .from(schema.receipts)
            .where(inArray(schema.receipts.paymentId, paymentIds))
        : [];
    const receiptIds = receiptRows.map((receipt) => receipt.id);
    const auditEntityIds = [...paymentIds, ...receiptIds, ...createdAssessmentIds];

    if (createdCheckoutIds.length > 0) {
      await db
        .delete(schema.mockPaymentCallbackEvents)
        .where(inArray(schema.mockPaymentCallbackEvents.checkoutId, createdCheckoutIds));
      await db
        .delete(schema.mockPaymentCheckouts)
        .where(inArray(schema.mockPaymentCheckouts.id, createdCheckoutIds));
    }
    if (paymentIds.length > 0) {
      await db
        .delete(schema.paymentReversals)
        .where(inArray(schema.paymentReversals.paymentId, paymentIds));
      await db
        .delete(schema.paymentAllocations)
        .where(inArray(schema.paymentAllocations.paymentId, paymentIds));
      await db.delete(schema.receipts).where(inArray(schema.receipts.paymentId, paymentIds));
      await db.delete(schema.payments).where(inArray(schema.payments.id, paymentIds));
    }
    if (auditEntityIds.length > 0) {
      await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.entityId, auditEntityIds));
    }
    if (createdStudentIds.length > 0) {
      await db
        .delete(schema.ledgerEntries)
        .where(inArray(schema.ledgerEntries.studentId, createdStudentIds));
      await db
        .delete(schema.guardianStudents)
        .where(inArray(schema.guardianStudents.studentId, createdStudentIds));
    }
    for (const assessmentId of createdAssessmentIds) {
      await db
        .delete(schema.assessmentItems)
        .where(eq(schema.assessmentItems.assessmentId, assessmentId));
      await db
        .delete(schema.studentAssessments)
        .where(eq(schema.studentAssessments.id, assessmentId));
    }
    for (const guardianId of createdGuardianIds) {
      await db.delete(schema.guardians).where(eq(schema.guardians.id, guardianId));
    }
    for (const studentId of createdStudentIds) {
      await db.delete(schema.students).where(eq(schema.students.id, studentId));
    }
    for (const userId of createdUserIds) {
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
    for (const structureId of createdStructureIds) {
      await db
        .delete(schema.feeStructureItems)
        .where(eq(schema.feeStructureItems.feeStructureId, structureId));
      await db.delete(schema.feeStructures).where(eq(schema.feeStructures.id, structureId));
    }
    for (const categoryId of createdCategoryIds) {
      await db.delete(schema.feeCategories).where(eq(schema.feeCategories.id, categoryId));
    }
  }

  console.log(`Portals and online payments contract verified: ${checks.join(', ')}.`);
}

async function expectRejected(operation: () => Promise<unknown>, message: string) {
  let rejected = false;
  try {
    await operation();
  } catch {
    rejected = true;
  }
  assertCheck(rejected, message);
}

main().catch((error) => {
  logSanitizedError('verification.portals_online_payment', error);
  process.exitCode = 1;
});
