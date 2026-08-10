import dotenv from 'dotenv';
import path from 'path';
import { and, eq, inArray, or } from 'drizzle-orm';
import { getDb } from '../index';
import * as schema from '../schema';
import { logSanitizedError } from '../../server/logging';
import {
  createFeeCategory,
  createFeeStructure,
  createStudent,
} from '../../server/services/students-fees.service';
import { AssessmentService } from '../../server/services/assessment.service';
import {
  getPayment,
  getReceiptPdfData,
  listPayments,
  PaymentService,
} from '../../server/services/payment.service';
import { generateReceiptPdf } from '../../lib/pdf/receipt-generator';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function assertCheck(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for payment and receipt verification.');
  }

  const db = getDb(process.env.DATABASE_URL);
  const stamp = Date.now();
  const checks: string[] = [];
  const createdStudentIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdStructureIds: string[] = [];
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
  const adminUser = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, 'admin@demo.school'))
    .limit(1);

  assertCheck(Boolean(activeSchoolYear[0]), 'Seed data must include an active school year.');
  assertCheck(Boolean(gradeLevel[0]), 'Seed data must include a grade level.');
  assertCheck(Boolean(adminUser[0]), 'Seed data must include the demo admin account.');

  try {
    const tuitionCategory = await createFeeCategory(
      {
        name: `Phase Six Tuition ${stamp}`,
        code: `PAY-TUITION-${stamp}`,
        description: 'Phase 6 payment verification category',
        status: 'ACTIVE',
      },
      db
    );
    const activitiesCategory = await createFeeCategory(
      {
        name: `Phase Six Activities ${stamp}`,
        code: `PAY-ACTIVITIES-${stamp}`,
        description: 'Phase 6 payment verification category',
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
        name: `Phase Six Annual ${stamp}`,
        status: 'ACTIVE',
        items: [
          { feeCategoryId: tuitionCategory.id, name: 'Tuition', amountCentavos: 120000 },
          { feeCategoryId: activitiesCategory.id, name: 'Activities', amountCentavos: 80000 },
        ],
      },
      db
    );
    createdStructureIds.push(structure.id);

    const student = await createStudent(
      {
        studentNumber: `VERIFY-PAY-${stamp}`,
        firstName: 'Phase Six',
        lastName: 'Student',
        email: `phase-six-student-${stamp}@example.com`,
        userId: null,
        gradeLevelId: gradeLevel[0].id,
        sectionId: null,
        schoolYearId: activeSchoolYear[0].id,
        status: 'ACTIVE',
      },
      db
    );
    createdStudentIds.push(student.id);
    const assessment = await AssessmentService.generateAssessment(
      {
        studentId: student.id,
        feeStructureId: structure.id,
        actorUserId: adminUser[0].id,
      },
      db
    );
    createdAssessmentIds.push(assessment.id);

    const paymentInput = {
      studentId: student.id,
      amountCentavos: 130000,
      paymentMethod: 'CASH' as const,
      referenceNumber: `CASH-${stamp}`,
      idempotencyKey: `phase-six-payment-${stamp}`,
      processedByUserId: adminUser[0].id,
    };
    const payment = await PaymentService.recordPayment(paymentInput, db);
    assertCheck(payment.status === 'POSTED', 'Cash payment did not persist as posted.');
    assertCheck(payment.receipt?.status === 'ACTIVE', 'Payment receipt was not active.');
    assertCheck(
      payment.allocations.length === 2,
      'Cash payment did not allocate across both items.'
    );
    assertCheck(
      payment.allocations[0]?.amountCentavos === 120000 &&
        payment.allocations[1]?.amountCentavos === 10000,
      'Payment allocation did not follow oldest-item order.'
    );
    assertCheck(payment.remainingBalanceCentavos === 70000, 'Payment balance did not reconcile.');
    assertCheck(
      /^[A-Za-z0-9]+-\d{4}-\d{6}$/.test(payment.receipt?.receiptNumber ?? ''),
      'Receipt number did not use the configured human-facing sequence format.'
    );
    checks.push(
      'partial cash payment persistence, oldest-item allocation, receipt, and ledger balance'
    );

    const replay = await PaymentService.recordPayment(paymentInput, db);
    assertCheck(replay.id === payment.id, 'Duplicate idempotency key created another payment.');
    const paymentCount = await db
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(eq(schema.payments.studentId, student.id));
    assertCheck(paymentCount.length === 1, 'Duplicate form submission created multiple payments.');
    checks.push('idempotent duplicate submission');

    let semanticConflictRejected = false;
    try {
      await PaymentService.recordPayment(
        { ...paymentInput, amountCentavos: 130001, referenceNumber: `CONFLICT-${stamp}` },
        db
      );
    } catch (error) {
      semanticConflictRejected =
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        error.statusCode === 409;
    }
    assertCheck(
      semanticConflictRejected,
      'A reused idempotency key accepted changed payment semantics.'
    );
    checks.push('semantic idempotency conflict rejection');

    let overpaymentRejected = false;
    try {
      await PaymentService.recordPayment(
        {
          ...paymentInput,
          amountCentavos: 70001,
          idempotencyKey: `phase-six-overpayment-${stamp}`,
          referenceNumber: `OVER-${stamp}`,
        },
        db
      );
    } catch {
      overpaymentRejected = true;
    }
    assertCheck(overpaymentRejected, 'Overpayment was accepted.');
    assertCheck(
      (
        await db
          .select({ id: schema.payments.id })
          .from(schema.payments)
          .where(eq(schema.payments.studentId, student.id))
      ).length === 1,
      'Rejected overpayment left a payment behind.'
    );
    checks.push('authoritative overpayment rejection');

    const concurrentStudent = await createStudent(
      {
        studentNumber: `VERIFY-CONC-${stamp}`,
        firstName: 'Phase Six Concurrent',
        lastName: 'Student',
        email: `phase-six-concurrent-${stamp}@example.com`,
        userId: null,
        gradeLevelId: gradeLevel[0].id,
        sectionId: null,
        schoolYearId: activeSchoolYear[0].id,
        status: 'ACTIVE',
      },
      db
    );
    createdStudentIds.push(concurrentStudent.id);
    const concurrentAssessment = await AssessmentService.generateAssessment(
      {
        studentId: concurrentStudent.id,
        feeStructureId: structure.id,
        actorUserId: adminUser[0].id,
      },
      db
    );
    createdAssessmentIds.push(concurrentAssessment.id);
    const concurrentInput = {
      studentId: concurrentStudent.id,
      amountCentavos: 50000,
      paymentMethod: 'BANK_DEPOSIT' as const,
      referenceNumber: `BANK-${stamp}`,
      idempotencyKey: `phase-six-concurrent-${stamp}`,
      processedByUserId: adminUser[0].id,
    };
    const concurrentResults = await Promise.all([
      PaymentService.recordPayment(concurrentInput, db),
      PaymentService.recordPayment(concurrentInput, db),
    ]);
    assertCheck(
      concurrentResults[0].id === concurrentResults[1].id,
      'Concurrent duplicate submissions returned different payments.'
    );
    assertCheck(
      (
        await db
          .select({ id: schema.payments.id })
          .from(schema.payments)
          .where(eq(schema.payments.studentId, concurrentStudent.id))
      ).length === 1,
      'Concurrent duplicate submissions created more than one payment.'
    );
    checks.push('concurrent idempotency and bank-deposit persistence');

    const adjustmentStudent = await createStudent(
      {
        studentNumber: `VERIFY-DEBIT-${stamp}`,
        firstName: 'Phase Six Debit',
        lastName: 'Student',
        email: `phase-six-debit-${stamp}@example.com`,
        userId: null,
        gradeLevelId: gradeLevel[0].id,
        sectionId: null,
        schoolYearId: activeSchoolYear[0].id,
        status: 'ACTIVE',
      },
      db
    );
    createdStudentIds.push(adjustmentStudent.id);
    const adjustmentAssessment = await AssessmentService.generateAssessment(
      {
        studentId: adjustmentStudent.id,
        feeStructureId: structure.id,
        actorUserId: adminUser[0].id,
      },
      db
    );
    createdAssessmentIds.push(adjustmentAssessment.id);
    const debitAdjustment = await AssessmentService.applyAdjustment(
      {
        assessmentId: adjustmentAssessment.id,
        studentId: adjustmentStudent.id,
        type: 'DEBIT',
        amountCentavos: 30000,
        reason: 'Phase 6 debit adjustment payment target',
        actorUserId: adminUser[0].id,
      },
      db
    );
    const debitPayment = await PaymentService.recordPayment(
      {
        studentId: adjustmentStudent.id,
        amountCentavos: 230000,
        paymentMethod: 'CASH',
        referenceNumber: `DEBIT-${stamp}`,
        idempotencyKey: `phase-six-debit-${stamp}`,
        processedByUserId: adminUser[0].id,
      },
      db
    );
    assertCheck(
      debitPayment.allocations.some(
        (allocation) =>
          allocation.adjustmentId === debitAdjustment.adjustment.id &&
          allocation.allocationType === 'DEBIT_ADJUSTMENT' &&
          allocation.amountCentavos === 30000
      ),
      'Debit adjustment was not a payable allocation target.'
    );
    const debitLedger = await db
      .select({
        entryType: schema.ledgerEntries.entryType,
        assessmentId: schema.ledgerEntries.assessmentId,
      })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.studentId, adjustmentStudent.id));
    assertCheck(
      debitLedger
        .filter((entry) => entry.entryType === 'PAYMENT')
        .every((entry) => entry.assessmentId === adjustmentAssessment.id),
      'Debit-target payment ledger attribution was not assessment-specific.'
    );
    checks.push('debit adjustment payment allocation and assessment attribution');

    const reversal = await PaymentService.reversePayment(
      {
        paymentId: payment.id,
        reason: 'Phase 6 reversal verification',
        reversedByUserId: adminUser[0].id,
      },
      db
    );
    assertCheck(
      reversal.paymentStatus === 'REVERSED',
      'Payment reversal did not update payment status.'
    );
    assertCheck(reversal.receiptStatus === 'VOIDED', 'Payment reversal did not void the receipt.');
    const reversedPayment = await getPayment(payment.id, db);
    assertCheck(reversedPayment.status === 'REVERSED', 'Original payment is no longer queryable.');
    assertCheck(reversedPayment.receipt?.status === 'VOIDED', 'Stored receipt was not voided.');
    assertCheck(
      reversedPayment.remainingBalanceCentavos === 200000,
      'Reversal did not restore the balance.'
    );

    let doubleReversalRejected = false;
    try {
      await PaymentService.reversePayment(
        {
          paymentId: payment.id,
          reason: 'Phase 6 duplicate reversal verification',
          reversedByUserId: adminUser[0].id,
        },
        db
      );
    } catch {
      doubleReversalRejected = true;
    }
    assertCheck(doubleReversalRejected, 'Double reversal was accepted.');
    checks.push(
      'compensating reversal, voided receipt, preserved original, and double-reversal protection'
    );

    const pdfData = await getReceiptPdfData(payment.receipt?.id ?? '', db);
    const pdfBytes = await generateReceiptPdf(pdfData);
    assertCheck(
      pdfData.status === 'VOIDED',
      'Receipt PDF data did not reflect the voided receipt.'
    );
    assertCheck(pdfBytes.length > 500, 'Stored receipt data did not generate a PDF.');
    const transactionList = await listPayments(
      { search: payment.receipt?.receiptNumber ?? '' },
      db
    );
    assertCheck(
      transactionList.items[0]?.status === 'REVERSED',
      'Transaction list lost reversal status.'
    );
    const auditRows = await db
      .select({ action: schema.auditLogs.action, entityId: schema.auditLogs.entityId })
      .from(schema.auditLogs)
      .where(
        or(
          eq(schema.auditLogs.entityId, payment.id),
          eq(schema.auditLogs.entityId, payment.receipt?.id ?? '')
        )
      );
    assertCheck(
      auditRows.some((row) => row.action === 'PAYMENT_POSTED'),
      'Payment audit event missing.'
    );
    assertCheck(
      auditRows.some((row) => row.action === 'RECEIPT_ISSUED'),
      'Receipt audit event missing.'
    );
    assertCheck(
      auditRows.some((row) => row.action === 'PAYMENT_REVERSED'),
      'Reversal audit event missing.'
    );
    checks.push('stored receipt PDF and posted/reversed audit visibility');
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
    const adjustmentRows =
      createdStudentIds.length > 0
        ? await db
            .select({ id: schema.adjustments.id })
            .from(schema.adjustments)
            .where(inArray(schema.adjustments.studentId, createdStudentIds))
        : [];
    const auditEntityIds = [
      ...paymentIds,
      ...receiptIds,
      ...createdAssessmentIds,
      ...adjustmentRows.map((adjustment) => adjustment.id),
    ];

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
        .delete(schema.adjustments)
        .where(inArray(schema.adjustments.studentId, createdStudentIds));
      await db
        .delete(schema.ledgerEntries)
        .where(inArray(schema.ledgerEntries.studentId, createdStudentIds));
    }
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
      await db.delete(schema.students).where(eq(schema.students.id, studentId));
    }
    for (const categoryId of createdCategoryIds) {
      await db.delete(schema.feeCategories).where(eq(schema.feeCategories.id, categoryId));
    }
  }

  console.log(`Payments, receipts, and reversals contract verified: ${checks.join(', ')}.`);
}

main().catch((error) => {
  logSanitizedError('verification.payments_receipts', error);
  process.exitCode = 1;
});
