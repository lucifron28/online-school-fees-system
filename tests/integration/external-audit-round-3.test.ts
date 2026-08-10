import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { generateStatementPdf } from '@/lib/pdf/statement-generator';
import { AssessmentService, getAssessment } from '@/server/services/assessment.service';
import {
  getMockCheckout,
  MockPaymentGateway,
  processMockCallback,
} from '@/server/services/payment-gateway.service';
import { getPayment, getReceiptPdfData, PaymentService } from '@/server/services/payment.service';
import { ReportService } from '@/server/services/report.service';
import { listStudents } from '@/server/services/students-fees.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseContract = testDatabaseUrl ? describe : describe.skip;

type AcademicContext = {
  schoolYearId: string;
  gradeLevelId: string;
  feeStructureId: string;
  feeCategoryId: string;
  adminUserId: string;
};

type AssessmentFixture = {
  studentId: string;
  assessmentId: string;
  assessmentItemId: string;
  amountCentavos: number;
};

function assertDefined<T>(value: T | undefined, message: string): T {
  if (!value) throw new Error(message);
  return value;
}

async function academicContext(db: DatabaseInstance): Promise<AcademicContext> {
  const schoolYear = assertDefined(
    (
      await db
        .select({ id: schema.schoolYears.id })
        .from(schema.schoolYears)
        .where(eq(schema.schoolYears.status, 'ACTIVE'))
        .limit(1)
    )[0],
    'Round 3 requires an active school year.'
  );
  const gradeLevel = assertDefined(
    (
      await db
        .select({ id: schema.gradeLevels.id })
        .from(schema.gradeLevels)
        .orderBy(asc(schema.gradeLevels.displayOrder))
        .limit(1)
    )[0],
    'Round 3 requires a grade level.'
  );
  const feeStructure = assertDefined(
    (
      await db
        .select({ id: schema.feeStructures.id })
        .from(schema.feeStructures)
        .where(
          and(
            eq(schema.feeStructures.schoolYearId, schoolYear.id),
            eq(schema.feeStructures.gradeLevelId, gradeLevel.id),
            eq(schema.feeStructures.status, 'ACTIVE')
          )
        )
        .limit(1)
    )[0],
    'Round 3 requires an active fee structure.'
  );
  const feeCategory = assertDefined(
    (await db.select({ id: schema.feeCategories.id }).from(schema.feeCategories).limit(1))[0],
    'Round 3 requires a fee category.'
  );
  const admin = assertDefined(
    (
      await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@demo.school'))
        .limit(1)
    )[0],
    'Round 3 requires the seeded admin account.'
  );
  return {
    schoolYearId: schoolYear.id,
    gradeLevelId: gradeLevel.id,
    feeStructureId: feeStructure.id,
    feeCategoryId: feeCategory.id,
    adminUserId: admin.id,
  };
}

async function createStudent(
  db: DatabaseInstance,
  context: AcademicContext,
  suffix: string,
  status: 'ACTIVE' | 'INACTIVE' | 'WITHDRAWN' | 'GRADUATED' = 'ACTIVE'
) {
  const [student] = await db
    .insert(schema.students)
    .values({
      studentNumber: `R3-${suffix}`,
      firstName: 'Round',
      lastName: 'Three',
      email: `round-three-${suffix}@schoolfees.example.com`,
      gradeLevelId: context.gradeLevelId,
      schoolYearId: context.schoolYearId,
      status,
    })
    .returning({ id: schema.students.id });
  return assertDefined(student, 'Round 3 student fixture could not be created.').id;
}

async function createAssessment(
  db: DatabaseInstance,
  context: AcademicContext,
  studentId: string,
  suffix: string,
  amountCentavos: number,
  period: 'ANNUAL' | 'SEMESTER' | 'TRIMESTER' | 'MONTHLY',
  createdAt: Date,
  priorBalanceCentavos = 0
): Promise<AssessmentFixture> {
  const [assessment] = await db
    .insert(schema.studentAssessments)
    .values({
      studentId,
      schoolYearId: context.schoolYearId,
      feeStructureId: context.feeStructureId,
      assessmentPeriod: period,
      totalAmountCentavos: amountCentavos,
      status: 'POSTED',
      createdAt,
    })
    .returning({ id: schema.studentAssessments.id });
  const createdAssessment = assertDefined(assessment, 'Round 3 assessment could not be created.');
  const [item] = await db
    .insert(schema.assessmentItems)
    .values({
      assessmentId: createdAssessment.id,
      feeCategoryId: context.feeCategoryId,
      name: `Round 3 charge ${suffix}`,
      amountCentavos,
      createdAt,
    })
    .returning({ id: schema.assessmentItems.id });
  const createdItem = assertDefined(item, 'Round 3 assessment item could not be created.');
  await db.insert(schema.ledgerEntries).values({
    studentId,
    assessmentId: createdAssessment.id,
    entryType: 'ASSESSMENT',
    debitCentavos: amountCentavos,
    creditCentavos: 0,
    balanceCentavos: priorBalanceCentavos + amountCentavos,
    description: `Round 3 assessment fixture ${suffix}`,
    createdAt,
  });
  return {
    studentId,
    assessmentId: createdAssessment.id,
    assessmentItemId: createdItem.id,
    amountCentavos,
  };
}

async function createDirectPayment(
  db: DatabaseInstance,
  context: AcademicContext,
  fixture: AssessmentFixture,
  amountCentavos: number,
  createdAt: Date,
  suffix: string
) {
  const [payment] = await db
    .insert(schema.payments)
    .values({
      studentId: fixture.studentId,
      assessmentId: fixture.assessmentId,
      amountCentavos,
      paymentMethod: 'CASH',
      referenceNumber: `R3-DIRECT-${suffix}`,
      idempotencyKey: `r3-direct-${suffix}`,
      status: 'POSTED',
      processedByUserId: context.adminUserId,
      createdAt,
      updatedAt: createdAt,
    })
    .returning();
  const createdPayment = assertDefined(payment, 'Round 3 direct payment could not be created.');
  await db.insert(schema.paymentAllocations).values({
    paymentId: createdPayment.id,
    assessmentItemId: fixture.assessmentItemId,
    adjustmentId: null,
    amountCentavos,
    createdAt,
  });
  const [receipt] = await db
    .insert(schema.receipts)
    .values({
      paymentId: createdPayment.id,
      receiptNumber: `R3-RECEIPT-${suffix}`,
      verificationIdentifier: `R3-VER-${suffix}`,
      issuanceSnapshot: null,
      createdAt,
    })
    .returning();
  return { payment: createdPayment, receipt: assertDefined(receipt, 'Receipt fixture missing.') };
}

async function cleanupStudent(db: DatabaseInstance, studentId: string) {
  const paymentRows = await db
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(eq(schema.payments.studentId, studentId));
  const paymentIds = paymentRows.map((row) => row.id);
  const checkoutRows = await db
    .select({ id: schema.mockPaymentCheckouts.id })
    .from(schema.mockPaymentCheckouts)
    .where(eq(schema.mockPaymentCheckouts.studentId, studentId));
  const checkoutIds = checkoutRows.map((row) => row.id);
  const assessmentRows = await db
    .select({ id: schema.studentAssessments.id })
    .from(schema.studentAssessments)
    .where(eq(schema.studentAssessments.studentId, studentId));
  const assessmentIds = assessmentRows.map((row) => row.id);
  const adjustmentRows = await db
    .select({ id: schema.adjustments.id })
    .from(schema.adjustments)
    .where(eq(schema.adjustments.studentId, studentId));
  const entityIds = [
    studentId,
    ...assessmentIds,
    ...adjustmentRows.map((row) => row.id),
    ...paymentIds,
    ...checkoutIds,
  ];

  await db.transaction(async (tx) => {
    if (checkoutIds.length > 0) {
      await tx
        .delete(schema.mockPaymentCallbackEvents)
        .where(inArray(schema.mockPaymentCallbackEvents.checkoutId, checkoutIds));
      await tx
        .delete(schema.mockPaymentCheckouts)
        .where(inArray(schema.mockPaymentCheckouts.id, checkoutIds));
    }
    if (paymentIds.length > 0) {
      await tx
        .delete(schema.paymentReversals)
        .where(inArray(schema.paymentReversals.paymentId, paymentIds));
      await tx
        .delete(schema.paymentAllocations)
        .where(inArray(schema.paymentAllocations.paymentId, paymentIds));
      await tx.delete(schema.receipts).where(inArray(schema.receipts.paymentId, paymentIds));
      await tx.delete(schema.payments).where(inArray(schema.payments.id, paymentIds));
    }
    await tx.delete(schema.auditLogs).where(inArray(schema.auditLogs.entityId, entityIds));
    await tx.delete(schema.notifications).where(inArray(schema.notifications.entityId, entityIds));
    await tx.delete(schema.ledgerEntries).where(eq(schema.ledgerEntries.studentId, studentId));
    await tx.delete(schema.adjustments).where(eq(schema.adjustments.studentId, studentId));
    if (assessmentIds.length > 0) {
      await tx
        .delete(schema.assessmentItems)
        .where(inArray(schema.assessmentItems.assessmentId, assessmentIds));
      await tx
        .delete(schema.studentAssessments)
        .where(inArray(schema.studentAssessments.id, assessmentIds));
    }
    await tx.delete(schema.students).where(eq(schema.students.id, studentId));
  });
}

async function createCheckout(
  db: DatabaseInstance,
  context: AcademicContext,
  studentId: string,
  amountCentavos: number,
  suffix: string
) {
  return new MockPaymentGateway(db).createCheckout({
    studentId,
    amountCentavos,
    paymentChannel: 'GCash',
    idempotencyKey: `r3-checkout-${suffix}`,
    parentUserId: context.adminUserId,
  });
}

function callback(
  paymentReference: string,
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING',
  suffix: string
) {
  return {
    paymentReference,
    status,
    eventId: `r3-event-${status.toLowerCase()}-${suffix}`,
    idempotencyKey: `r3-callback-${status.toLowerCase()}-${suffix}`,
  };
}

databaseContract('external audit round 3 regressions', () => {
  const db = getDb(testDatabaseUrl);

  it('rejects credit overage on one assessment while another assessment remains positive', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const first = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'SEMESTER',
      new Date(),
      100_00
    );
    try {
      await expect(
        AssessmentService.applyAdjustment(
          {
            assessmentId: first.assessmentId,
            studentId,
            type: 'CREDIT',
            amountCentavos: 101_00,
            reason: 'Round 3 over-credit',
            actorUserId: context.adminUserId,
          },
          db
        )
      ).rejects.toThrow(/assessment balance/);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('accepts an exact assessment credit that brings only that assessment to zero', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const first = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    const second = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'SEMESTER',
      new Date(),
      100_00
    );
    try {
      await AssessmentService.applyAdjustment(
        {
          assessmentId: first.assessmentId,
          studentId,
          type: 'CREDIT',
          amountCentavos: 100_00,
          reason: 'Round 3 exact credit',
          actorUserId: context.adminUserId,
        },
        db
      );
      expect((await getAssessment(first.assessmentId, db)).balanceCentavos).toBe(0);
      expect((await getAssessment(second.assessmentId, db)).balanceCentavos).toBe(100_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('keeps debit and credit adjustments isolated to their assessment', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    try {
      await AssessmentService.applyAdjustment(
        {
          assessmentId: fixture.assessmentId,
          studentId,
          type: 'DEBIT',
          amountCentavos: 50_00,
          reason: 'Round 3 debit',
          actorUserId: context.adminUserId,
        },
        db
      );
      await AssessmentService.applyAdjustment(
        {
          assessmentId: fixture.assessmentId,
          studentId,
          type: 'CREDIT',
          amountCentavos: 20_00,
          reason: 'Round 3 credit',
          actorUserId: context.adminUserId,
        },
        db
      );
      expect((await getAssessment(fixture.assessmentId, db)).balanceCentavos).toBe(130_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('rejects a credit that exceeds an assessment after leaving credit residue', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    try {
      await AssessmentService.applyAdjustment(
        {
          assessmentId: fixture.assessmentId,
          studentId,
          type: 'CREDIT',
          amountCentavos: 80_00,
          reason: 'Round 3 residue credit',
          actorUserId: context.adminUserId,
        },
        db
      );
      await expect(
        AssessmentService.applyAdjustment(
          {
            assessmentId: fixture.assessmentId,
            studentId,
            type: 'CREDIT',
            amountCentavos: 21_00,
            reason: 'Round 3 invalid residue credit',
            actorUserId: context.adminUserId,
          },
          db
        )
      ).rejects.toThrow(/assessment balance/);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('reconciles all assessment-attributed ledger entries to the student ledger', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const first = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    const second = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      75_00,
      'SEMESTER',
      new Date(),
      100_00
    );
    try {
      await AssessmentService.applyAdjustment(
        {
          assessmentId: first.assessmentId,
          studentId,
          type: 'CREDIT',
          amountCentavos: 20_00,
          reason: 'Round 3 reconciliation credit',
          actorUserId: context.adminUserId,
        },
        db
      );
      const entries = await db
        .select({
          assessmentId: schema.ledgerEntries.assessmentId,
          debitCentavos: schema.ledgerEntries.debitCentavos,
          creditCentavos: schema.ledgerEntries.creditCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, studentId));
      const attributed = entries.reduce(
        (total, entry) => total + entry.debitCentavos - entry.creditCentavos,
        0
      );
      expect(attributed).toBe(155_00);
      expect(second.assessmentId).toBeTruthy();
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('allocates A100 with A80 credit and B100 payment as A20 then B80', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const first = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    const second = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'SEMESTER',
      new Date(),
      100_00
    );
    try {
      await AssessmentService.applyAdjustment(
        {
          assessmentId: first.assessmentId,
          studentId,
          type: 'CREDIT',
          amountCentavos: 80_00,
          reason: 'Round 3 allocation credit',
          actorUserId: context.adminUserId,
        },
        db
      );
      const payment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 100_00,
          paymentMethod: 'CASH',
          idempotencyKey: `r3-payment-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      expect(payment.allocations.map((item) => [item.assessmentId, item.amountCentavos])).toEqual([
        [first.assessmentId, 20_00],
        [second.assessmentId, 80_00],
      ]);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('allocates entirely to B when A100 has an exact A100 credit', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const first = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    const second = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'SEMESTER',
      new Date(),
      100_00
    );
    try {
      await AssessmentService.applyAdjustment(
        {
          assessmentId: first.assessmentId,
          studentId,
          type: 'CREDIT',
          amountCentavos: 100_00,
          reason: 'Round 3 full allocation credit',
          actorUserId: context.adminUserId,
        },
        db
      );
      const payment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 50_00,
          paymentMethod: 'CASH',
          idempotencyKey: `r3-payment-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      expect(payment.allocations).toHaveLength(1);
      expect(payment.allocations[0]).toMatchObject({
        assessmentId: second.assessmentId,
        amountCentavos: 50_00,
      });
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('allocates debit and credit residue across targets within one assessment', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    try {
      await AssessmentService.applyAdjustment(
        {
          assessmentId: fixture.assessmentId,
          studentId,
          type: 'DEBIT',
          amountCentavos: 50_00,
          reason: 'Round 3 target debit',
          actorUserId: context.adminUserId,
        },
        db
      );
      await AssessmentService.applyAdjustment(
        {
          assessmentId: fixture.assessmentId,
          studentId,
          type: 'CREDIT',
          amountCentavos: 20_00,
          reason: 'Round 3 target credit',
          actorUserId: context.adminUserId,
        },
        db
      );
      const payment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 130_00,
          paymentMethod: 'CASH',
          idempotencyKey: `r3-payment-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      expect(payment.remainingBalanceCentavos).toBe(0);
      expect(payment.allocations.reduce((total, item) => total + item.amountCentavos, 0)).toBe(
        130_00
      );
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('keeps oldest assessment allocation order deterministic across multiple assessments', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const first = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date('2026-01-01T00:00:00Z')
    );
    const second = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'SEMESTER',
      new Date('2026-02-01T00:00:00Z'),
      100_00
    );
    try {
      const payment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 110_00,
          paymentMethod: 'CASH',
          idempotencyKey: `r3-payment-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      expect(payment.allocations.map((item) => item.assessmentId)).toEqual([
        first.assessmentId,
        second.assessmentId,
      ]);
      expect(payment.allocations.map((item) => item.amountCentavos)).toEqual([100_00, 10_00]);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('serializes concurrent payments under the student ledger lock', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    await createAssessment(db, context, studentId, randomUUID(), 100_00, 'ANNUAL', new Date());
    try {
      const results = await Promise.allSettled([
        PaymentService.recordPayment(
          {
            studentId,
            amountCentavos: 60_00,
            paymentMethod: 'CASH',
            idempotencyKey: `r3-concurrent-${randomUUID()}`,
            processedByUserId: context.adminUserId,
            skipNotifications: true,
          },
          db
        ),
        PaymentService.recordPayment(
          {
            studentId,
            amountCentavos: 60_00,
            paymentMethod: 'CASH',
            idempotencyKey: `r3-concurrent-${randomUUID()}`,
            processedByUserId: context.adminUserId,
            skipNotifications: true,
          },
          db
        ),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(
        (await ReportService.getStudentStatement(studentId, {}, db)).closingBalanceCentavos
      ).toBe(40_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('serializes a concurrent credit adjustment and payment without negative residue', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    try {
      const results = await Promise.allSettled([
        AssessmentService.applyAdjustment(
          {
            assessmentId: fixture.assessmentId,
            studentId,
            type: 'CREDIT',
            amountCentavos: 20_00,
            reason: 'Round 3 concurrent credit',
            actorUserId: context.adminUserId,
          },
          db
        ),
        PaymentService.recordPayment(
          {
            studentId,
            amountCentavos: 50_00,
            paymentMethod: 'CASH',
            idempotencyKey: `r3-concurrent-adjustment-${randomUUID()}`,
            processedByUserId: context.adminUserId,
            skipNotifications: true,
          },
          db
        ),
      ]);
      expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
      expect(
        (await ReportService.getStudentStatement(studentId, {}, db)).closingBalanceCentavos
      ).toBe(30_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('reverses an allocated payment and restores the assessment balance', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    try {
      const payment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 50_00,
          paymentMethod: 'CASH',
          idempotencyKey: `r3-reversal-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      const reversal = await PaymentService.reversePayment(
        {
          paymentId: payment.id,
          reason: 'Round 3 reversal',
          reversedByUserId: context.adminUserId,
        },
        db
      );
      expect(reversal.receiptStatus).toBe('VOIDED');
      expect((await getAssessment(fixture.assessmentId, db)).balanceCentavos).toBe(100_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('keeps a receipt snapshot unchanged after a later payment', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    try {
      const first = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 25_00,
          paymentMethod: 'CASH',
          idempotencyKey: `r3-snapshot-first-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      const firstPdf = await getReceiptPdfData(first.receipt!.id, db);
      await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 10_00,
          paymentMethod: 'CASH',
          idempotencyKey: `r3-snapshot-second-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      const historicalPdf = await getReceiptPdfData(first.receipt!.id, db);
      expect(firstPdf.balanceAfterPaymentCentavos).toBe(75_00);
      expect(historicalPdf.balanceAfterPaymentCentavos).toBe(75_00);
      expect(historicalPdf.receiptNumber).toBe(firstPdf.receiptNumber);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('preserves receipt snapshot facts when a payment is reversed and only changes status', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    try {
      const payment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 25_00,
          paymentMethod: 'CASH',
          idempotencyKey: `r3-voided-snapshot-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      const before = await getReceiptPdfData(payment.receipt!.id, db);
      await PaymentService.reversePayment(
        {
          paymentId: payment.id,
          reason: 'Round 3 voided receipt',
          reversedByUserId: context.adminUserId,
        },
        db
      );
      const after = await getReceiptPdfData(payment.receipt!.id, db);
      expect(after.status).toBe('VOIDED');
      expect(after.balanceAfterPaymentCentavos).toBe(before.balanceAfterPaymentCentavos);
      expect(after.amountReceivedCentavos).toBe(before.amountReceivedCentavos);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('uses a deterministic null balance for a legacy receipt without a snapshot', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date()
    );
    try {
      const payment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 25_00,
          paymentMethod: 'CASH',
          idempotencyKey: `r3-legacy-receipt-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      await db
        .update(schema.receipts)
        .set({ issuanceSnapshot: null })
        .where(eq(schema.receipts.id, payment.receipt!.id));
      const legacy = await getReceiptPdfData(payment.receipt!.id, db);
      expect(legacy.balanceAfterPaymentCentavos).toBeNull();
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('includes positive persisted debt for withdrawn students in the outstanding report', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID(), 'WITHDRAWN');
    await createAssessment(db, context, studentId, randomUUID(), 100_00, 'ANNUAL', new Date());
    try {
      const row = (await ReportService.getOutstandingBalanceReport(db)).find(
        (item) => item.studentId === studentId
      );
      expect(row).toMatchObject({ status: 'WITHDRAWN', outstandingBalanceCentavos: 100_00 });
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('counts only active students while dashboard debt includes withdrawn students', async () => {
    const context = await academicContext(db);
    const before = await ReportService.getDashboardSummary(db);
    const studentId = await createStudent(db, context, randomUUID(), 'WITHDRAWN');
    await createAssessment(db, context, studentId, randomUUID(), 100_00, 'ANNUAL', new Date());
    try {
      const after = await ReportService.getDashboardSummary(db);
      expect(after.activeStudents).toBe(before.activeStudents);
      expect(after.outstandingBalanceCentavos).toBe(before.outstandingBalanceCentavos + 100_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('allows a non-active student to settle existing assessment debt', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID(), 'WITHDRAWN');
    await createAssessment(db, context, studentId, randomUUID(), 100_00, 'ANNUAL', new Date());
    try {
      const payment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 40_00,
          paymentMethod: 'CASH',
          idempotencyKey: `r3-withdrawn-payment-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      expect(payment.remainingBalanceCentavos).toBe(60_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('blocks a new assessment for a non-active student', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID(), 'WITHDRAWN');
    try {
      await expect(
        AssessmentService.generateAssessment(
          { studentId, feeStructureId: context.feeStructureId, actorUserId: context.adminUserId },
          db
        )
      ).rejects.toThrow(/Only active students/);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('uses the pre-period Manila ledger balance as the statement opening balance', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const beforeStart = new Date('2026-07-31T15:59:59.000Z');
    const start = new Date('2026-07-31T16:00:00.000Z');
    const end = new Date('2026-08-01T16:00:00.000Z');
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      beforeStart
    );
    try {
      await db.insert(schema.ledgerEntries).values([
        {
          studentId,
          assessmentId: fixture.assessmentId,
          entryType: 'DEBIT_ADJUSTMENT',
          debitCentavos: 50_00,
          creditCentavos: 0,
          balanceCentavos: 150_00,
          description: 'Round 3 start-boundary debit',
          createdAt: start,
        },
        {
          studentId,
          assessmentId: fixture.assessmentId,
          entryType: 'DEBIT_ADJUSTMENT',
          debitCentavos: 25_00,
          creditCentavos: 0,
          balanceCentavos: 175_00,
          description: 'Round 3 end-boundary debit',
          createdAt: end,
        },
      ]);
      const statement = await ReportService.getStudentStatement(
        studentId,
        { from: '2026-08-01', to: '2026-08-01' },
        db
      );
      expect(statement.openingBalanceCentavos).toBe(100_00);
      expect(statement.entries).toHaveLength(1);
      expect(statement.closingBalanceCentavos).toBe(150_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('includes the next Manila day only when it is inside the requested period', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const beforeStart = new Date('2026-07-31T15:59:59.000Z');
    const rangeStart = new Date('2026-08-01T16:00:00.000Z');
    const rangeEnd = new Date('2026-08-02T16:00:00.000Z');
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      beforeStart
    );
    try {
      await db.insert(schema.ledgerEntries).values([
        {
          studentId,
          assessmentId: fixture.assessmentId,
          entryType: 'DEBIT_ADJUSTMENT',
          debitCentavos: 50_00,
          creditCentavos: 0,
          balanceCentavos: 150_00,
          description: 'Round 3 requested-day debit',
          createdAt: rangeStart,
        },
        {
          studentId,
          assessmentId: fixture.assessmentId,
          entryType: 'DEBIT_ADJUSTMENT',
          debitCentavos: 25_00,
          creditCentavos: 0,
          balanceCentavos: 175_00,
          description: 'Round 3 exclusive-end debit',
          createdAt: rangeEnd,
        },
      ]);
      const statement = await ReportService.getStudentStatement(
        studentId,
        { from: '2026-08-02', to: '2026-08-02' },
        db
      );
      expect(statement.openingBalanceCentavos).toBe(100_00);
      expect(statement.entries).toHaveLength(1);
      expect(statement.closingBalanceCentavos).toBe(150_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('filters statement payments with the same inclusive/exclusive Manila boundaries', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const beforeStart = new Date('2026-07-31T15:59:59.000Z');
    const start = new Date('2026-07-31T16:00:00.000Z');
    const end = new Date('2026-08-01T16:00:00.000Z');
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      beforeStart
    );
    try {
      await createDirectPayment(db, context, fixture, 10_00, start, randomUUID());
      await createDirectPayment(db, context, fixture, 10_00, end, randomUUID());
      const statement = await ReportService.getStudentStatement(
        studentId,
        { from: '2026-08-01', to: '2026-08-01' },
        db
      );
      expect(statement.payments).toHaveLength(1);
      expect(statement.payments[0].amountCentavos).toBe(10_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('renders the requested statement period, opening balance, activity, and closing balance as a PDF', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const fixture = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      100_00,
      'ANNUAL',
      new Date('2026-07-31T15:59:59.000Z')
    );
    try {
      await db.insert(schema.ledgerEntries).values({
        studentId,
        assessmentId: fixture.assessmentId,
        entryType: 'DEBIT_ADJUSTMENT',
        debitCentavos: 25_00,
        creditCentavos: 0,
        balanceCentavos: 125_00,
        description: 'Round 3 statement PDF activity',
        createdAt: new Date('2026-07-31T16:00:00.000Z'),
      });
      const statement = await ReportService.getStudentStatement(
        studentId,
        { from: '2026-08-01', to: '2026-08-01' },
        db
      );
      const pdf = await generateStatementPdf(statement);
      expect(pdf).toBeInstanceOf(Uint8Array);
      expect(pdf.length).toBeGreaterThan(500);
      expect(statement.openingBalanceCentavos).toBe(100_00);
      expect(statement.closingBalanceCentavos).toBe(125_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('records pending callbacks without changing a created checkout or ledger', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    await createAssessment(db, context, studentId, randomUUID(), 100_00, 'ANNUAL', new Date());
    const suffix = randomUUID();
    try {
      const checkout = await createCheckout(db, context, studentId, 20_00, suffix);
      const result = await processMockCallback(
        callback(checkout.paymentReference, 'PENDING', suffix),
        db
      );
      expect(result.checkoutStatus).toBe('CREATED');
      expect(result.paymentId).toBeNull();
      expect(
        (await ReportService.getStudentStatement(studentId, {}, db)).closingBalanceCentavos
      ).toBe(100_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('keeps a failed checkout terminal when a later success callback arrives', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    await createAssessment(db, context, studentId, randomUUID(), 100_00, 'ANNUAL', new Date());
    const suffix = randomUUID();
    try {
      const checkout = await createCheckout(db, context, studentId, 20_00, suffix);
      await processMockCallback(callback(checkout.paymentReference, 'FAILED', suffix), db);
      const result = await processMockCallback(
        {
          ...callback(checkout.paymentReference, 'SUCCESS', `${suffix}-late`),
          eventId: `r3-late-success-${suffix}`,
          idempotencyKey: `r3-late-success-${suffix}`,
        },
        db
      );
      expect(result.checkoutStatus).toBe('FAILED');
      expect(result.paymentId).toBeNull();
      expect((await getMockCheckout(checkout.paymentReference, db)).status).toBe('FAILED');
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('keeps a cancelled checkout terminal when a later success callback arrives', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    await createAssessment(db, context, studentId, randomUUID(), 100_00, 'ANNUAL', new Date());
    const suffix = randomUUID();
    try {
      const checkout = await createCheckout(db, context, studentId, 20_00, suffix);
      await processMockCallback(callback(checkout.paymentReference, 'CANCELLED', suffix), db);
      const result = await processMockCallback(
        {
          ...callback(checkout.paymentReference, 'SUCCESS', `${suffix}-late`),
          eventId: `r3-late-cancel-success-${suffix}`,
          idempotencyKey: `r3-late-cancel-success-${suffix}`,
        },
        db
      );
      expect(result.checkoutStatus).toBe('CANCELLED');
      expect(result.paymentId).toBeNull();
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('keeps a succeeded checkout terminal when a later failed callback arrives', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    await createAssessment(db, context, studentId, randomUUID(), 100_00, 'ANNUAL', new Date());
    const suffix = randomUUID();
    try {
      const checkout = await createCheckout(db, context, studentId, 20_00, suffix);
      const success = await processMockCallback(
        callback(checkout.paymentReference, 'SUCCESS', suffix),
        db
      );
      expect(success.checkoutStatus).toBe('SUCCEEDED');
      const result = await processMockCallback(
        {
          ...callback(checkout.paymentReference, 'FAILED', `${suffix}-late`),
          eventId: `r3-late-failed-${suffix}`,
          idempotencyKey: `r3-late-failed-${suffix}`,
        },
        db
      );
      expect(result.checkoutStatus).toBe('SUCCEEDED');
      expect(result.paymentId).toBe(success.paymentId);
      expect(
        (await ReportService.getStudentStatement(studentId, {}, db)).closingBalanceCentavos
      ).toBe(80_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('marks an expired checkout terminal and does not create a payment', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    await createAssessment(db, context, studentId, randomUUID(), 100_00, 'ANNUAL', new Date());
    const suffix = randomUUID();
    try {
      const checkout = await createCheckout(db, context, studentId, 20_00, suffix);
      await db
        .update(schema.mockPaymentCheckouts)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(schema.mockPaymentCheckouts.id, checkout.checkoutId));
      const result = await processMockCallback(
        callback(checkout.paymentReference, 'SUCCESS', suffix),
        db
      );
      expect(result.checkoutStatus).toBe('EXPIRED');
      expect(result.paymentId).toBeNull();
      expect(
        (await ReportService.getStudentStatement(studentId, {}, db)).closingBalanceCentavos
      ).toBe(100_00);
    } finally {
      await cleanupStudent(db, studentId);
    }
  });

  it('searches a bounded student page beyond the first hundred records', async () => {
    const context = await academicContext(db);
    const suffix = randomUUID();
    const searchPrefix = `R3-BULK-${suffix}`;
    const rows = await db
      .insert(schema.students)
      .values(
        Array.from({ length: 105 }, (_, index) => ({
          studentNumber: `${searchPrefix}-${index}`,
          firstName: 'Bulk',
          lastName: `Student ${index}`,
          email: `r3-bulk-${suffix}-${index}@schoolfees.example.com`,
          gradeLevelId: context.gradeLevelId,
          schoolYearId: context.schoolYearId,
          status: index === 104 ? ('WITHDRAWN' as const) : ('ACTIVE' as const),
        }))
      )
      .returning({ id: schema.students.id });
    const studentIds = rows.map((row) => row.id);

    try {
      const firstPage = await listStudents(
        { page: 1, pageSize: 20, search: searchPrefix, sort: 'studentNumber', direction: 'asc' },
        db
      );
      expect(firstPage.pagination.total).toBe(105);
      expect(firstPage.data).toHaveLength(20);

      const beyondFirstPage = await listStudents(
        { page: 1, pageSize: 20, search: `${searchPrefix}-104`, sort: 'studentNumber' },
        db
      );
      expect(beyondFirstPage.data).toHaveLength(1);
      expect(beyondFirstPage.data[0]).toMatchObject({
        studentNumber: `${searchPrefix}-104`,
        status: 'WITHDRAWN',
      });
    } finally {
      await db.delete(schema.students).where(inArray(schema.students.id, studentIds));
    }
  });

  it('snapshots staff names for manual payments and the system name for mock online payments', async () => {
    const context = await academicContext(db);
    const adminUser = assertDefined(
      (
        await db
          .select({ name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.id, context.adminUserId))
          .limit(1)
      )[0],
      'Round 3 admin fixture could not be loaded.'
    );
    const studentIds = await Promise.all(
      Array.from({ length: 3 }, () => createStudent(db, context, randomUUID()))
    );
    const fixtures = await Promise.all(
      studentIds.map((studentId) =>
        createAssessment(db, context, studentId, randomUUID(), 100_00, 'ANNUAL', new Date())
      )
    );

    try {
      const cash = await PaymentService.recordPayment(
        {
          studentId: studentIds[0]!,
          amountCentavos: 10_00,
          paymentMethod: 'CASH',
          idempotencyKey: `r3-processor-cash-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      const bank = await PaymentService.recordPayment(
        {
          studentId: studentIds[1]!,
          amountCentavos: 10_00,
          paymentMethod: 'BANK_DEPOSIT',
          idempotencyKey: `r3-processor-bank-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      const mockOnline = await PaymentService.recordPayment(
        {
          studentId: studentIds[2]!,
          amountCentavos: 10_00,
          paymentMethod: 'MOCK_ONLINE',
          idempotencyKey: `r3-processor-mock-${randomUUID()}`,
          skipNotifications: true,
        },
        db
      );

      expect((await getReceiptPdfData(cash.receipt!.id, db)).processedByName).toBe(adminUser.name);
      expect((await getReceiptPdfData(bank.receipt!.id, db)).processedByName).toBe(adminUser.name);
      expect((await getReceiptPdfData(mockOnline.receipt!.id, db)).processedByName).toBe(
        'Mock online payment system'
      );

      await db
        .update(schema.users)
        .set({ name: `${adminUser.name} Renamed` })
        .where(eq(schema.users.id, context.adminUserId));
      expect((await getReceiptPdfData(cash.receipt!.id, db)).processedByName).toBe(adminUser.name);
    } finally {
      await db
        .update(schema.users)
        .set({ name: adminUser.name })
        .where(eq(schema.users.id, context.adminUserId));
      for (const studentId of studentIds) await cleanupStudent(db, studentId);
      expect(fixtures).toHaveLength(3);
    }
  });
});
