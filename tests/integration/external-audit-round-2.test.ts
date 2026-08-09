import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { AssessmentService } from '@/server/services/assessment.service';
import { updateUser } from '@/server/services/administration.service';
import {
  getMockCheckout,
  MockPaymentGateway,
  processMockCallback,
} from '@/server/services/payment-gateway.service';
import { getPayment, getReceiptPdfData, PaymentService } from '@/server/services/payment.service';
import { ReportService } from '@/server/services/report.service';
import {
  createFeeCategory,
  createFeeStructure,
  linkGuardianStudent,
  updateFeeStructure,
} from '@/server/services/students-fees.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseContract = testDatabaseUrl ? describe : describe.skip;

type AssessmentFixture = {
  studentId: string;
  assessmentId: string;
  assessmentItemId: string;
  amountCentavos: number;
};

type AcademicContext = {
  schoolYearId: string;
  gradeLevelId: string;
  feeStructureId: string;
  feeCategoryId: string;
  adminUserId: string;
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
    'Round 2 requires an active school year.'
  );
  const gradeLevel = assertDefined(
    (
      await db
        .select({ id: schema.gradeLevels.id })
        .from(schema.gradeLevels)
        .orderBy(asc(schema.gradeLevels.displayOrder))
        .limit(1)
    )[0],
    'Round 2 requires a grade level.'
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
    'Round 2 requires an active fee structure.'
  );
  const feeCategory = assertDefined(
    (await db.select({ id: schema.feeCategories.id }).from(schema.feeCategories).limit(1))[0],
    'Round 2 requires a fee category.'
  );
  const admin = assertDefined(
    (
      await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@demo.school'))
        .limit(1)
    )[0],
    'Round 2 requires the seeded admin account.'
  );
  return {
    schoolYearId: schoolYear.id,
    gradeLevelId: gradeLevel.id,
    feeStructureId: feeStructure.id,
    feeCategoryId: feeCategory.id,
    adminUserId: admin.id,
  };
}

async function createStudent(db: DatabaseInstance, context: AcademicContext, suffix: string) {
  const [student] = await db
    .insert(schema.students)
    .values({
      studentNumber: `R2-${suffix}`,
      firstName: 'Round',
      lastName: 'Two',
      email: `round-two-${suffix}@schoolfees.example.com`,
      gradeLevelId: context.gradeLevelId,
      schoolYearId: context.schoolYearId,
      status: 'ACTIVE',
    })
    .returning({ id: schema.students.id });
  return assertDefined(student, 'Round 2 student fixture could not be created.').id;
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
  const createdAssessment = assertDefined(
    assessment,
    'Round 2 assessment fixture could not be created.'
  );
  const [item] = await db
    .insert(schema.assessmentItems)
    .values({
      assessmentId: createdAssessment.id,
      feeCategoryId: context.feeCategoryId,
      name: `Round 2 charge ${suffix}`,
      amountCentavos,
      createdAt,
    })
    .returning({ id: schema.assessmentItems.id });
  const createdItem = assertDefined(item, 'Round 2 assessment item fixture could not be created.');
  await db.insert(schema.ledgerEntries).values({
    studentId,
    assessmentId: createdAssessment.id,
    entryType: 'ASSESSMENT',
    debitCentavos: amountCentavos,
    creditCentavos: 0,
    balanceCentavos: priorBalanceCentavos + amountCentavos,
    description: `Round 2 assessment fixture ${suffix}`,
    createdAt,
  });
  return {
    studentId,
    assessmentId: createdAssessment.id,
    assessmentItemId: createdItem.id,
    amountCentavos,
  };
}

async function cleanupStudents(
  db: DatabaseInstance,
  studentIds: string[],
  extraAssessmentIds: string[] = [],
  extraStructureIds: string[] = [],
  extraCategoryIds: string[] = [],
  guardianIds: string[] = []
) {
  if (studentIds.length === 0) return;
  const paymentRows = await db
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(inArray(schema.payments.studentId, studentIds));
  const paymentIds = paymentRows.map((row) => row.id);
  const receiptRows =
    paymentIds.length === 0
      ? []
      : await db
          .select({ id: schema.receipts.id })
          .from(schema.receipts)
          .where(inArray(schema.receipts.paymentId, paymentIds));
  const receiptIds = receiptRows.map((row) => row.id);
  const checkoutRows = await db
    .select({ id: schema.mockPaymentCheckouts.id })
    .from(schema.mockPaymentCheckouts)
    .where(inArray(schema.mockPaymentCheckouts.studentId, studentIds));
  const checkoutIds = checkoutRows.map((row) => row.id);
  const assessmentRows = await db
    .select({ id: schema.studentAssessments.id })
    .from(schema.studentAssessments)
    .where(inArray(schema.studentAssessments.studentId, studentIds));
  const assessmentIds = [
    ...new Set([...assessmentRows.map((row) => row.id), ...extraAssessmentIds]),
  ];
  const adjustmentRows = await db
    .select({ id: schema.adjustments.id })
    .from(schema.adjustments)
    .where(inArray(schema.adjustments.studentId, studentIds));
  const entityIds = [
    ...studentIds,
    ...assessmentIds,
    ...adjustmentRows.map((row) => row.id),
    ...paymentIds,
    ...receiptIds,
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
    if (entityIds.length > 0) {
      await tx.delete(schema.auditLogs).where(inArray(schema.auditLogs.entityId, entityIds));
      await tx
        .delete(schema.notifications)
        .where(inArray(schema.notifications.entityId, entityIds));
    }
    await tx
      .delete(schema.guardianStudents)
      .where(inArray(schema.guardianStudents.studentId, studentIds));
    await tx
      .delete(schema.ledgerEntries)
      .where(inArray(schema.ledgerEntries.studentId, studentIds));
    await tx.delete(schema.adjustments).where(inArray(schema.adjustments.studentId, studentIds));
    if (assessmentIds.length > 0) {
      await tx
        .delete(schema.assessmentItems)
        .where(inArray(schema.assessmentItems.assessmentId, assessmentIds));
      await tx
        .delete(schema.studentAssessments)
        .where(inArray(schema.studentAssessments.id, assessmentIds));
    }
    await tx.delete(schema.students).where(inArray(schema.students.id, studentIds));
    if (guardianIds.length > 0) {
      await tx.delete(schema.guardians).where(inArray(schema.guardians.id, guardianIds));
    }
    for (const structureId of extraStructureIds) {
      await tx
        .delete(schema.feeStructureItems)
        .where(eq(schema.feeStructureItems.feeStructureId, structureId));
      await tx.delete(schema.feeStructures).where(eq(schema.feeStructures.id, structureId));
    }
    if (extraCategoryIds.length > 0) {
      await tx
        .delete(schema.feeCategories)
        .where(inArray(schema.feeCategories.id, extraCategoryIds));
    }
  });
}

async function createGuardian(db: DatabaseInstance, suffix: string) {
  const [guardian] = await db
    .insert(schema.guardians)
    .values({
      firstName: 'Round',
      lastName: `Guardian ${suffix}`,
      email: `round-guardian-${suffix}@schoolfees.example.com`,
      phone: '+63 917 000 0000',
      relationship: 'Parent',
      address: 'Fictional Round 2 address',
    })
    .returning({ id: schema.guardians.id });
  return assertDefined(guardian, 'Round 2 guardian fixture could not be created.').id;
}

databaseContract('external audit round 2 regressions', () => {
  const db = getDb(testDatabaseUrl);

  it('allocates debit adjustments and posts/reverses one ledger group per assessment', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const assessment = await createAssessment(
      db,
      context,
      studentId,
      randomUUID(),
      70_000_0,
      'ANNUAL',
      new Date(Date.now() - 1000)
    );

    try {
      const adjustment = await AssessmentService.applyAdjustment(
        {
          assessmentId: assessment.assessmentId,
          studentId,
          type: 'DEBIT',
          amountCentavos: 10_000_0,
          reason: 'Round 2 debit adjustment',
          actorUserId: context.adminUserId,
        },
        db
      );
      const payment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 80_000_0,
          paymentMethod: 'CASH',
          referenceNumber: `R2-DEBIT-${randomUUID()}`,
          idempotencyKey: `r2-debit-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      expect(payment.remainingBalanceCentavos).toBe(0);
      expect(payment.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            assessmentItemId: assessment.assessmentItemId,
            adjustmentId: null,
            allocationType: 'ASSESSMENT_ITEM',
            amountCentavos: 70_000_0,
          }),
          expect.objectContaining({
            assessmentItemId: null,
            adjustmentId: adjustment.adjustment.id,
            allocationType: 'DEBIT_ADJUSTMENT',
            amountCentavos: 10_000_0,
          }),
        ])
      );
      const receiptData = await getReceiptPdfData(payment.receipt!.id, db);
      expect(receiptData.allocations.map((allocation) => allocation.name)).toEqual(
        expect.arrayContaining(['Round 2 debit adjustment'])
      );
      const paymentLedger = await db
        .select()
        .from(schema.ledgerEntries)
        .where(
          and(
            eq(schema.ledgerEntries.studentId, studentId),
            eq(schema.ledgerEntries.entryType, 'PAYMENT')
          )
        );
      expect(paymentLedger).toHaveLength(1);
      expect(paymentLedger[0]?.assessmentId).toBe(assessment.assessmentId);
      expect(paymentLedger[0]?.creditCentavos).toBe(80_000_0);

      const reversal = await PaymentService.reversePayment(
        {
          paymentId: payment.id,
          reason: 'Round 2 debit reversal',
          reversedByUserId: context.adminUserId,
        },
        db
      );
      expect(reversal.balanceCentavos).toBe(80_000_0);
      const reversalLedger = await db
        .select()
        .from(schema.ledgerEntries)
        .where(
          and(
            eq(schema.ledgerEntries.studentId, studentId),
            eq(schema.ledgerEntries.entryType, 'REVERSAL')
          )
        );
      expect(reversalLedger).toHaveLength(1);
      expect(reversalLedger[0]?.assessmentId).toBe(assessment.assessmentId);
      expect(reversalLedger[0]?.debitCentavos).toBe(80_000_0);
    } finally {
      await cleanupStudents(db, [studentId]);
    }
  });

  it('pays a debit adjustment after assessment settlement and supports partial allocation', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const assessment = await createAssessment(
      db,
      context,
      studentId,
      'adjustment-after-settlement',
      70_000_0,
      'ANNUAL',
      new Date(Date.now() - 1000)
    );

    try {
      const assessmentPayment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 70_000_0,
          paymentMethod: 'CASH',
          referenceNumber: `R2-SETTLE-${randomUUID()}`,
          idempotencyKey: `r2-settle-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      expect(assessmentPayment.remainingBalanceCentavos).toBe(0);
      expect(assessmentPayment.allocations).toEqual([
        expect.objectContaining({
          assessmentItemId: assessment.assessmentItemId,
          adjustmentId: null,
          amountCentavos: 70_000_0,
        }),
      ]);

      const adjustment = await AssessmentService.applyAdjustment(
        {
          assessmentId: assessment.assessmentId,
          studentId,
          type: 'DEBIT',
          amountCentavos: 10_000_0,
          reason: 'Round 2 post-settlement adjustment',
          actorUserId: context.adminUserId,
        },
        db
      );
      const partialPayment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 4_000_0,
          paymentMethod: 'CASH',
          referenceNumber: `R2-PARTIAL-${randomUUID()}`,
          idempotencyKey: `r2-partial-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      expect(partialPayment.remainingBalanceCentavos).toBe(6_000_0);
      expect(partialPayment.allocations).toEqual([
        expect.objectContaining({
          assessmentItemId: null,
          adjustmentId: adjustment.adjustment.id,
          allocationType: 'DEBIT_ADJUSTMENT',
          amountCentavos: 4_000_0,
        }),
      ]);

      const finalPayment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 6_000_0,
          paymentMethod: 'CASH',
          referenceNumber: `R2-FINAL-${randomUUID()}`,
          idempotencyKey: `r2-final-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      expect(finalPayment.remainingBalanceCentavos).toBe(0);
      expect(finalPayment.allocations).toEqual([
        expect.objectContaining({
          assessmentItemId: null,
          adjustmentId: adjustment.adjustment.id,
          allocationType: 'DEBIT_ADJUSTMENT',
          amountCentavos: 6_000_0,
        }),
      ]);
      for (const payment of [partialPayment, finalPayment]) {
        expect(
          payment.allocations.reduce((total, allocation) => total + allocation.amountCentavos, 0)
        ).toBe(payment.amountCentavos);
      }
    } finally {
      await cleanupStudents(db, [studentId]);
    }
  });

  it('attributes multi-assessment payments and reversals to each represented assessment', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const first = await createAssessment(
      db,
      context,
      studentId,
      'first',
      70_000_0,
      'ANNUAL',
      new Date(Date.now() - 10_000)
    );
    const second = await createAssessment(
      db,
      context,
      studentId,
      'second',
      70_000_0,
      'SEMESTER',
      new Date(Date.now() - 5_000),
      70_000_0
    );
    const third = await createAssessment(
      db,
      context,
      studentId,
      'third',
      70_000_0,
      'TRIMESTER',
      new Date(Date.now() - 1_000),
      140_000_0
    );

    try {
      const payment = await PaymentService.recordPayment(
        {
          studentId,
          amountCentavos: 150_000_0,
          paymentMethod: 'BANK_DEPOSIT',
          referenceNumber: `R2-MULTI-${randomUUID()}`,
          idempotencyKey: `r2-multi-${randomUUID()}`,
          processedByUserId: context.adminUserId,
          skipNotifications: true,
        },
        db
      );
      expect(payment.assessmentId).toBeNull();
      expect(payment.remainingBalanceCentavos).toBe(60_000_0);
      expect(
        payment.allocations.reduce((total, allocation) => total + allocation.amountCentavos, 0)
      ).toBe(payment.amountCentavos);
      expect(payment.allocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ assessmentId: first.assessmentId, amountCentavos: 70_000_0 }),
          expect.objectContaining({ assessmentId: second.assessmentId, amountCentavos: 70_000_0 }),
          expect.objectContaining({ assessmentId: third.assessmentId, amountCentavos: 10_000_0 }),
        ])
      );
      const collectionReport = await ReportService.getCollectionReport(
        { from: '2026-01-01', to: '2026-12-31' },
        db
      );
      expect(collectionReport.items.find((item) => item.id === payment.id)).toMatchObject({
        amountCentavos: payment.amountCentavos,
        reconciliationStatus: 'RECONCILED',
      });
      const paymentLedger = await db
        .select({
          assessmentId: schema.ledgerEntries.assessmentId,
          credit: schema.ledgerEntries.creditCentavos,
        })
        .from(schema.ledgerEntries)
        .where(
          and(
            eq(schema.ledgerEntries.studentId, studentId),
            eq(schema.ledgerEntries.entryType, 'PAYMENT')
          )
        )
        .orderBy(asc(schema.ledgerEntries.createdAt));
      expect(paymentLedger).toEqual([
        { assessmentId: first.assessmentId, credit: 70_000_0 },
        { assessmentId: second.assessmentId, credit: 70_000_0 },
        { assessmentId: third.assessmentId, credit: 10_000_0 },
      ]);
      const allLedgerRows = await db
        .select({
          assessmentId: schema.ledgerEntries.assessmentId,
          debit: schema.ledgerEntries.debitCentavos,
          credit: schema.ledgerEntries.creditCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, studentId));
      const assessmentBalance = (assessmentId: string) =>
        allLedgerRows
          .filter((entry) => entry.assessmentId === assessmentId)
          .reduce((balance, entry) => balance + entry.debit - entry.credit, 0);
      expect(assessmentBalance(first.assessmentId)).toBe(0);
      expect(assessmentBalance(second.assessmentId)).toBe(0);
      expect(assessmentBalance(third.assessmentId)).toBe(60_000_0);

      await PaymentService.reversePayment(
        {
          paymentId: payment.id,
          reason: 'Round 2 multi-assessment reversal',
          reversedByUserId: context.adminUserId,
        },
        db
      );
      const reversalLedger = await db
        .select({
          assessmentId: schema.ledgerEntries.assessmentId,
          debit: schema.ledgerEntries.debitCentavos,
        })
        .from(schema.ledgerEntries)
        .where(
          and(
            eq(schema.ledgerEntries.studentId, studentId),
            eq(schema.ledgerEntries.entryType, 'REVERSAL')
          )
        )
        .orderBy(asc(schema.ledgerEntries.createdAt));
      expect(reversalLedger).toEqual([
        { assessmentId: first.assessmentId, debit: 70_000_0 },
        { assessmentId: second.assessmentId, debit: 70_000_0 },
        { assessmentId: third.assessmentId, debit: 10_000_0 },
      ]);
      const reversedLedgerRows = await db
        .select({
          assessmentId: schema.ledgerEntries.assessmentId,
          debit: schema.ledgerEntries.debitCentavos,
          credit: schema.ledgerEntries.creditCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, studentId));
      const reversedBalance = (assessmentId: string) =>
        reversedLedgerRows
          .filter((entry) => entry.assessmentId === assessmentId)
          .reduce((balance, entry) => balance + entry.debit - entry.credit, 0);
      expect(reversedBalance(first.assessmentId)).toBe(70_000_0);
      expect(reversedBalance(second.assessmentId)).toBe(70_000_0);
      expect(reversedBalance(third.assessmentId)).toBe(70_000_0);
    } finally {
      await cleanupStudents(db, [studentId]);
    }
  });

  it('replays compatible payment idempotency keys and rejects semantic conflicts under a race', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    await createAssessment(
      db,
      context,
      studentId,
      'idempotency',
      100_000_0,
      'ANNUAL',
      new Date(Date.now() - 1000)
    );

    try {
      const idempotencyKey = `r2-idempotency-${randomUUID()}`;
      const originalInput = {
        studentId,
        amountCentavos: 20_000_0,
        paymentMethod: 'CASH' as const,
        referenceNumber: ' R2-NORMALIZED-REFERENCE ',
        idempotencyKey,
        processedByUserId: context.adminUserId,
        skipNotifications: true,
      };
      const original = await PaymentService.recordPayment(originalInput, db);
      const replay = await PaymentService.recordPayment(
        { ...originalInput, referenceNumber: 'R2-NORMALIZED-REFERENCE' },
        db
      );
      expect(replay.id).toBe(original.id);
      await expect(
        PaymentService.recordPayment({ ...originalInput, amountCentavos: 21_000_0 }, db)
      ).rejects.toMatchObject({ statusCode: 409 });

      const raceKey = `r2-payment-race-${randomUUID()}`;
      const raceResults = await Promise.all(
        [1, 2].map(() =>
          PaymentService.recordPayment(
            {
              ...originalInput,
              amountCentavos: 10_000_0,
              referenceNumber: `R2-RACE-${raceKey}`,
              idempotencyKey: raceKey,
            },
            db
          )
        )
      );
      expect(new Set(raceResults.map((result) => result.id)).size).toBe(1);

      const conflictKey = `r2-conflict-race-${randomUUID()}`;
      const conflictResults = await Promise.allSettled([
        PaymentService.recordPayment(
          {
            ...originalInput,
            amountCentavos: 5_000_0,
            referenceNumber: `R2-CONFLICT-A-${conflictKey}`,
            idempotencyKey: conflictKey,
          },
          db
        ),
        PaymentService.recordPayment(
          {
            ...originalInput,
            amountCentavos: 6_000_0,
            referenceNumber: `R2-CONFLICT-B-${conflictKey}`,
            idempotencyKey: conflictKey,
          },
          db
        ),
      ]);
      expect(conflictResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = conflictResults.find((result) => result.status === 'rejected');
      expect(rejected?.status === 'rejected' && rejected.reason.statusCode).toBe(409);
    } finally {
      await cleanupStudents(db, [studentId]);
    }
  });

  it('serializes checkout semantics and expires an unpaid checkout before callback completion', async () => {
    const context = await academicContext(db);
    const studentId = await createStudent(db, context, randomUUID());
    const assessment = await createAssessment(
      db,
      context,
      studentId,
      'checkout',
      80_000_0,
      'ANNUAL',
      new Date(Date.now() - 1000)
    );
    const gateway = new MockPaymentGateway(db);
    const parentUserId = `round-two-parent-${randomUUID()}`;

    try {
      const input = {
        studentId,
        assessmentId: assessment.assessmentId,
        amountCentavos: 10_000_0,
        paymentChannel: 'GCash' as const,
        idempotencyKey: `r2-checkout-${randomUUID()}`,
        parentUserId,
      };
      const checkout = await gateway.createCheckout(input);
      const replay = await gateway.createCheckout(input);
      expect(replay.checkoutId).toBe(checkout.checkoutId);
      await expect(
        gateway.createCheckout({ ...input, amountCentavos: 11_000_0 })
      ).rejects.toMatchObject({
        statusCode: 409,
      });
      const persisted = (
        await db
          .select({ paymentChannel: schema.mockPaymentCheckouts.paymentChannel })
          .from(schema.mockPaymentCheckouts)
          .where(eq(schema.mockPaymentCheckouts.id, checkout.checkoutId))
      )[0];
      expect(persisted?.paymentChannel).toBe('GCash');

      const raceInput = {
        ...input,
        idempotencyKey: `r2-checkout-race-${randomUUID()}`,
        paymentChannel: 'Maya' as const,
      };
      const race = await Promise.all([
        gateway.createCheckout(raceInput),
        gateway.createCheckout(raceInput),
      ]);
      expect(new Set(race.map((result) => result.checkoutId)).size).toBe(1);

      const expired = await gateway.createCheckout({
        ...input,
        idempotencyKey: `r2-expiring-${randomUUID()}`,
        paymentChannel: 'CreditCard',
      });
      await db
        .update(schema.mockPaymentCheckouts)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(schema.mockPaymentCheckouts.id, expired.checkoutId));
      const expiredRead = await getMockCheckout(expired.paymentReference, db);
      expect(expiredRead.status).toBe('EXPIRED');
      const callbackInput = {
        paymentReference: expired.paymentReference,
        eventId: `r2-expired-event-${randomUUID()}`,
        idempotencyKey: `r2-expired-callback-${randomUUID()}`,
        status: 'SUCCESS' as const,
      };
      const callback = await processMockCallback(callbackInput, db);
      expect(callback.checkoutStatus).toBe('EXPIRED');
      expect(callback.paymentId).toBeNull();
      expect(callback.status).toBe('failed');
      const callbackReplay = await processMockCallback(callbackInput, db);
      expect(callbackReplay.isAlreadyProcessed).toBe(true);
      const payments = await db
        .select({ id: schema.payments.id })
        .from(schema.payments)
        .where(eq(schema.payments.studentId, studentId));
      expect(payments).toHaveLength(0);
    } finally {
      await cleanupStudents(db, [studentId]);
    }
  });

  it('keeps one active administrator and one primary guardian under concurrent mutations', async () => {
    const context = await academicContext(db);
    const suffix = randomUUID();
    const studentId = await createStudent(db, context, suffix);
    const guardianIds = await Promise.all([
      createGuardian(db, `${suffix}-a`),
      createGuardian(db, `${suffix}-b`),
    ]);
    const adminAccount = assertDefined(
      (
        await db
          .select({ id: schema.users.id, active: schema.users.active })
          .from(schema.users)
          .where(eq(schema.users.email, 'admin@demo.school'))
          .limit(1)
      )[0],
      'Seeded admin account is required for the administrator race.'
    );
    const tempAdminIds: string[] = [];

    try {
      await Promise.all(
        guardianIds.map((guardianId) =>
          linkGuardianStudent({ guardianId, studentId, isPrimary: true }, db)
        )
      );
      const primaryLinks = await db
        .select({ id: schema.guardianStudents.id })
        .from(schema.guardianStudents)
        .where(
          and(
            eq(schema.guardianStudents.studentId, studentId),
            eq(schema.guardianStudents.isPrimary, true)
          )
        );
      expect(primaryLinks).toHaveLength(1);
      await expect(
        linkGuardianStudent({ guardianId: guardianIds[0]!, studentId, isPrimary: false }, db)
      ).rejects.toThrow();

      const [firstAdmin, secondAdmin] = await db
        .insert(schema.users)
        .values([
          {
            id: randomUUID(),
            name: `Round 2 Admin A ${suffix}`,
            email: `round-two-admin-a-${suffix}@schoolfees.example.com`,
            role: 'ADMIN',
            active: true,
            emailVerified: true,
          },
          {
            id: randomUUID(),
            name: `Round 2 Admin B ${suffix}`,
            email: `round-two-admin-b-${suffix}@schoolfees.example.com`,
            role: 'ADMIN',
            active: true,
            emailVerified: true,
          },
        ])
        .returning({ id: schema.users.id });
      tempAdminIds.push(firstAdmin!.id, secondAdmin!.id);
      await db
        .update(schema.users)
        .set({ active: false })
        .where(eq(schema.users.id, adminAccount.id));

      const disableResults = await Promise.allSettled([
        updateUser(firstAdmin!.id, 'round-two-actor', { active: false }, db),
        updateUser(secondAdmin!.id, 'round-two-actor', { active: false }, db),
      ]);
      expect(disableResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(disableResults.filter((result) => result.status === 'rejected')).toHaveLength(1);

      await db
        .update(schema.users)
        .set({ role: 'ADMIN', active: true })
        .where(inArray(schema.users.id, tempAdminIds));
      const demoteResults = await Promise.allSettled([
        updateUser(firstAdmin!.id, 'round-two-actor', { role: 'STUDENT' }, db),
        updateUser(secondAdmin!.id, 'round-two-actor', { role: 'STUDENT' }, db),
      ]);
      expect(demoteResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(demoteResults.filter((result) => result.status === 'rejected')).toHaveLength(1);
      await expect(
        updateUser(firstAdmin!.id, firstAdmin!.id, { active: false }, db)
      ).rejects.toThrow();
    } finally {
      await db
        .update(schema.users)
        .set({ active: adminAccount.active })
        .where(eq(schema.users.id, adminAccount.id));
      if (tempAdminIds.length > 0) {
        await db.delete(schema.users).where(inArray(schema.users.id, tempAdminIds));
      }
      await cleanupStudents(db, [studentId], [], [], [], guardianIds);
    }
  });

  it('serializes fee-structure mutation with assessment posting and preserves a coherent snapshot', async () => {
    const context = await academicContext(db);
    const suffix = randomUUID();
    const studentId = await createStudent(db, context, suffix);
    const category = await createFeeCategory(
      {
        name: `Round 2 category ${suffix}`,
        code: `R2-${suffix.slice(0, 12)}`,
        description: 'Round 2 fee-structure race fixture',
        status: 'ACTIVE',
      },
      db
    );
    const structure = await createFeeStructure(
      {
        schoolYearId: context.schoolYearId,
        gradeLevelId: context.gradeLevelId,
        assessmentPeriod: 'ANNUAL',
        name: `Round 2 structure ${suffix}`,
        status: 'ACTIVE',
        items: [{ feeCategoryId: category.id, name: 'Original charge', amountCentavos: 50_000_0 }],
      },
      db
    );

    try {
      const results = await Promise.allSettled([
        AssessmentService.generateAssessment(
          { studentId, feeStructureId: structure.id, actorUserId: context.adminUserId },
          db
        ),
        updateFeeStructure(
          structure.id,
          {
            items: [
              { feeCategoryId: category.id, name: 'Serialized charge', amountCentavos: 70_000_0 },
            ],
          },
          db
        ),
      ]);
      expect(results.filter((result) => result.status === 'rejected').length).toBeLessThanOrEqual(
        1
      );

      const assessments = await db
        .select({
          id: schema.studentAssessments.id,
          total: schema.studentAssessments.totalAmountCentavos,
        })
        .from(schema.studentAssessments)
        .where(eq(schema.studentAssessments.studentId, studentId));
      expect(assessments).toHaveLength(1);
      const currentStructure = (
        await db
          .select({ amount: schema.feeStructureItems.amountCentavos })
          .from(schema.feeStructureItems)
          .where(eq(schema.feeStructureItems.feeStructureId, structure.id))
      )[0];
      expect(assessments[0]?.total).toBe(currentStructure?.amount);
    } finally {
      await cleanupStudents(db, [studentId], [], [structure.id], [category.id]);
    }
  });
});
