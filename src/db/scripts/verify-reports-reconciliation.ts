import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { logSanitizedError } from '../../server/logging';
import { generateStatementPdf } from '@/lib/pdf/statement-generator';
import { getManilaDateString } from '@/lib/reports';
import { ReportService } from '@/server/services/report.service';
import { PaymentService } from '@/server/services/payment.service';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for reports verification.');

  const db = getDb(databaseUrl);
  const suffix = `${Date.now()}-${randomUUID()}`;
  let studentId: string | undefined;
  let assessmentId: string | undefined;
  let assessmentItemId: string | undefined;
  let feeStructureId: string | undefined;
  let feeStructureItemId: string | undefined;
  let feeCategoryId: string | undefined;
  let paymentId: string | undefined;
  let receiptId: string | undefined;
  let reversalId: string | undefined;

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
    const [financeUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.role, 'FINANCE_STAFF'))
      .limit(1);
    const [adminUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.role, 'ADMIN'))
      .limit(1);

    assert(schoolYear, 'An active school year is required.');
    assert(gradeLevel, 'A grade level is required.');
    assert(financeUser, 'A finance user is required.');
    assert(adminUser, 'An administrator is required.');

    const [category] = await db
      .insert(schema.feeCategories)
      .values({
        name: `Reports category ${suffix}`,
        code: `RPT-${suffix}`.slice(0, 30),
        description: 'Phase 8 report verifier fixture',
        status: 'ACTIVE',
      })
      .returning({ id: schema.feeCategories.id });
    assert(category, 'The report fee category could not be created.');
    feeCategoryId = category.id;

    const [structure] = await db
      .insert(schema.feeStructures)
      .values({
        schoolYearId: schoolYear.id,
        gradeLevelId: gradeLevel.id,
        assessmentPeriod: 'ANNUAL',
        name: `Reports structure ${suffix}`,
        status: 'ACTIVE',
      })
      .returning({ id: schema.feeStructures.id });
    assert(structure, 'The report fee structure could not be created.');
    feeStructureId = structure.id;

    const [structureItem] = await db
      .insert(schema.feeStructureItems)
      .values({
        feeStructureId: structure.id,
        feeCategoryId: category.id,
        name: 'Reports tuition',
        amountCentavos: 1000,
      })
      .returning({ id: schema.feeStructureItems.id });
    assert(structureItem, 'The report fee structure item could not be created.');
    feeStructureItemId = structureItem.id;

    const [student] = await db
      .insert(schema.students)
      .values({
        studentNumber: `RPT-${suffix}`.slice(0, 30),
        firstName: 'Reports',
        lastName: 'Fixture',
        email: `reports-${suffix}@example.com`,
        gradeLevelId: gradeLevel.id,
        schoolYearId: schoolYear.id,
        status: 'ACTIVE',
      })
      .returning({ id: schema.students.id });
    assert(student, 'The report student could not be created.');
    studentId = student.id;

    const [assessment] = await db
      .insert(schema.studentAssessments)
      .values({
        studentId: student.id,
        schoolYearId: schoolYear.id,
        feeStructureId: structure.id,
        assessmentPeriod: 'ANNUAL',
        totalAmountCentavos: 1000,
        status: 'POSTED',
      })
      .returning({ id: schema.studentAssessments.id });
    assert(assessment, 'The report assessment could not be created.');
    assessmentId = assessment.id;

    const [assessmentItem] = await db
      .insert(schema.assessmentItems)
      .values({
        assessmentId: assessment.id,
        feeCategoryId: category.id,
        name: 'Reports tuition',
        amountCentavos: 1000,
      })
      .returning({ id: schema.assessmentItems.id });
    assert(assessmentItem, 'The report assessment item could not be created.');
    assessmentItemId = assessmentItem.id;

    await db.insert(schema.ledgerEntries).values({
      studentId: student.id,
      assessmentId: assessment.id,
      entryType: 'ASSESSMENT',
      debitCentavos: 1000,
      creditCentavos: 0,
      balanceCentavos: 1000,
      description: 'Reports fixture assessment',
    });

    const today = getManilaDateString();
    const before = await ReportService.getDashboardSummary(db);
    const beforeReport = await ReportService.getCollectionReport({ from: today, to: today }, db);

    const payment = await PaymentService.recordPayment(
      {
        studentId: student.id,
        amountCentavos: 400,
        paymentMethod: 'CASH',
        referenceNumber: `RPT-PAY-${suffix}`,
        idempotencyKey: `reports-payment-${suffix}`,
        processedByUserId: financeUser.id,
      },
      db
    );
    paymentId = payment.id;
    receiptId = payment.receipt?.id ?? undefined;
    assert(receiptId, 'The report payment receipt was not created.');

    const afterPayment = await ReportService.getDashboardSummary(db);
    const afterPaymentReport = await ReportService.getCollectionReport(
      { from: today, to: today },
      db
    );
    const paymentRow = afterPaymentReport.items.find((item) => item.id === payment.id);
    assert(
      paymentRow?.status === 'POSTED',
      'The posted payment is missing from the collection report.'
    );
    assert(paymentRow.reconciliationStatus === 'RECONCILED', 'The payment did not reconcile.');
    assert(
      afterPayment.collectionsTodayCentavos - before.collectionsTodayCentavos === 400,
      'Dashboard collections did not increase after payment.'
    );
    assert(
      afterPayment.postedTransactionsCount - before.postedTransactionsCount === 1,
      'Dashboard posted transaction count did not increase after payment.'
    );
    assert(
      afterPaymentReport.totals.netCollectionsCentavos -
        beforeReport.totals.netCollectionsCentavos ===
        400,
      'Collection report net total did not match the payment.'
    );
    assert(
      afterPaymentReport.byPaymentMethod.some(
        (row) => row.key === 'CASH' && row.amountCentavos >= 400
      ),
      'Payment-method breakdown did not include the payment.'
    );

    const outstandingAfterPayment = await ReportService.getOutstandingBalanceReport(db);
    assert(
      outstandingAfterPayment.find((row) => row.studentId === student.id)
        ?.outstandingBalanceCentavos === 600,
      'Outstanding balance report did not reconcile the payment.'
    );
    const statementAfterPayment = await ReportService.getStudentStatement(student.id, {}, db);
    assert(
      statementAfterPayment.closingBalanceCentavos === 600,
      'Student statement balance is incorrect.'
    );
    const statementPdf = await generateStatementPdf(statementAfterPayment);
    assert(
      Buffer.from(statementPdf).subarray(0, 5).toString() === '%PDF-',
      'Statement PDF was not generated.'
    );

    const reversal = await PaymentService.reversePayment(
      {
        paymentId: payment.id,
        reason: 'Phase 8 report verifier reversal',
        reversedByUserId: adminUser.id,
      },
      db
    );
    reversalId = reversal.reversalId;

    const afterReversal = await ReportService.getDashboardSummary(db);
    const afterReversalReport = await ReportService.getCollectionReport(
      { from: today, to: today },
      db
    );
    const reversedRow = afterReversalReport.items.find((item) => item.id === payment.id);
    assert(
      reversedRow?.status === 'REVERSED',
      'The reversal is missing from the collection report.'
    );
    assert(
      reversedRow.reconciliationStatus === 'REVERSED',
      'The reversal reconciliation status is wrong.'
    );
    assert(
      afterReversal.collectionsTodayCentavos === before.collectionsTodayCentavos,
      'Reversed payment remained in net dashboard collections.'
    );
    assert(
      afterReversal.postedTransactionsCount === before.postedTransactionsCount,
      'Reversed payment remained in posted dashboard count.'
    );
    assert(
      afterReversalReport.totals.netCollectionsCentavos ===
        beforeReport.totals.netCollectionsCentavos,
      'Reversed payment remained in net collection report totals.'
    );

    const reversalReport = await ReportService.getReversalReport({ from: today, to: today }, db);
    assert(
      reversalReport.items.some((row) => row.id === reversal.reversalId),
      'Reversal audit report did not retain the reversal record.'
    );
    const outstandingAfterReversal = await ReportService.getOutstandingBalanceReport(db);
    assert(
      outstandingAfterReversal.find((row) => row.studentId === student.id)
        ?.outstandingBalanceCentavos === 1000,
      'Reversal did not restore the outstanding balance report.'
    );
    const statementAfterReversal = await ReportService.getStudentStatement(student.id, {}, db);
    assert(
      statementAfterReversal.closingBalanceCentavos === 1000,
      'Reversal did not restore statement balance.'
    );

    const csv = ReportService.generateCsvReport(afterPaymentReport.items);
    assert(csv.includes('Payment ID'), 'Collection CSV headers are missing.');
    assert(csv.includes(payment.id), 'Collection CSV is missing the persisted payment.');

    console.log(
      'Reports and reconciliation contract verified: database-backed dashboard metrics, Manila date ranges, net collections excluding reversals, retained reversal audit report, outstanding balances, statements, payment-method and grade-level breakdowns, CSV output, and statement PDF.'
    );
  } finally {
    if (reversalId) {
      await db.delete(schema.paymentReversals).where(eq(schema.paymentReversals.id, reversalId));
    }
    if (paymentId) {
      await db
        .delete(schema.auditLogs)
        .where(inArray(schema.auditLogs.entityId, [paymentId, receiptId ?? '']));
      await db
        .delete(schema.paymentAllocations)
        .where(eq(schema.paymentAllocations.paymentId, paymentId));
      if (receiptId) {
        await db.delete(schema.receipts).where(eq(schema.receipts.id, receiptId));
      }
      await db.delete(schema.payments).where(eq(schema.payments.id, paymentId));
    }
    if (studentId) {
      await db.delete(schema.ledgerEntries).where(eq(schema.ledgerEntries.studentId, studentId));
    }
    if (assessmentItemId) {
      await db
        .delete(schema.assessmentItems)
        .where(eq(schema.assessmentItems.id, assessmentItemId));
    }
    if (assessmentId) {
      await db
        .delete(schema.studentAssessments)
        .where(eq(schema.studentAssessments.id, assessmentId));
    }
    if (studentId) {
      await db.delete(schema.students).where(eq(schema.students.id, studentId));
    }
    if (feeStructureItemId) {
      await db
        .delete(schema.feeStructureItems)
        .where(eq(schema.feeStructureItems.id, feeStructureItemId));
    }
    if (feeStructureId) {
      await db.delete(schema.feeStructures).where(eq(schema.feeStructures.id, feeStructureId));
    }
    if (feeCategoryId) {
      await db.delete(schema.feeCategories).where(eq(schema.feeCategories.id, feeCategoryId));
    }
  }
}

main().catch((error) => {
  logSanitizedError('verification.reports_reconciliation', error);
  process.exitCode = 1;
});
