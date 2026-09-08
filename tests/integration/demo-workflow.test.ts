import { and, eq, inArray } from 'drizzle-orm';
import { createAuth } from '@/lib/auth/server';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { AssessmentService } from '@/server/services/assessment.service';
import { processMockCallback } from '@/server/services/payment-gateway.service';
import { PaymentService } from '@/server/services/payment.service';
import { listOwnedPaymentsPage, PortalService } from '@/server/services/portal.service';
import { ReportService } from '@/server/services/report.service';
import { DEMO_NOW, seedDemoData } from '@/db/scripts/seed';
import { describe, expect, it } from 'vitest';

// This suite intentionally exercises the persisted mock gateway harness.
process.env.ENABLE_MOCK_PAYMENT_HARNESS = 'true';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseContract = testDatabaseUrl ? describe : describe.skip;
const expectedDemoStudentNumbers = Array.from(
  { length: 20 },
  (_, index) => `DEMO-${String(index + 1).padStart(4, '0')}`
);

function ledgerBalance(entries: Array<{ debitCentavos: number; creditCentavos: number }>) {
  return entries.reduce(
    (balance, entry) => balance + entry.debitCentavos - entry.creditCentavos,
    0
  );
}

databaseContract('deterministic demo database workflow', () => {
  const db = getDb(testDatabaseUrl);

  it('persists authentication, settings, academic, student, guardian, and fee fixtures', async () => {
    const demoUsers = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.active, true), eq(schema.users.email, 'admin@demo.school')));
    expect(demoUsers).toHaveLength(1);
    expect(demoUsers[0]?.role).toBe('ADMIN');

    const auth = createAuth({ database: db });
    const signIn = await auth.api.signInEmail({
      body: {
        email: 'admin@demo.school',
        password: 'DemoPass123!',
        rememberMe: false,
      },
    });
    expect(signIn.user?.email).toBe('admin@demo.school');

    const [
      settings,
      activeYears,
      grades,
      sections,
      students,
      guardians,
      links,
      categories,
      structures,
    ] = await Promise.all([
      db.select().from(schema.schoolSettings),
      db.select().from(schema.schoolYears).where(eq(schema.schoolYears.status, 'ACTIVE')),
      db.select().from(schema.gradeLevels),
      db.select().from(schema.sections),
      db.select().from(schema.students),
      db.select().from(schema.guardians),
      db.select().from(schema.guardianStudents),
      db.select().from(schema.feeCategories),
      db.select().from(schema.feeStructures),
    ]);

    expect(settings).toHaveLength(1);
    expect(settings[0]?.activeSchoolYearId).toBe(activeYears[0]?.id);
    expect(activeYears).toHaveLength(1);
    expect(grades.length).toBeGreaterThanOrEqual(6);
    expect(sections.length).toBeGreaterThanOrEqual(12);
    const demoStudents = students.filter((student) =>
      expectedDemoStudentNumbers.includes(student.studentNumber)
    );
    expect(demoStudents.map((student) => student.studentNumber).sort()).toEqual(
      expectedDemoStudentNumbers
    );
    const demoStudentIds = new Set(demoStudents.map((student) => student.id));
    const demoGuardians = guardians.filter((guardian) => guardian.email.includes('demo.school'));
    expect(demoGuardians).toHaveLength(10);
    const demoGuardianIds = new Set(demoGuardians.map((guardian) => guardian.id));
    expect(
      links.filter(
        (link) => demoStudentIds.has(link.studentId) && demoGuardianIds.has(link.guardianId)
      )
    ).toHaveLength(expectedDemoStudentNumbers.length);
    expect(categories.length).toBeGreaterThanOrEqual(4);
    expect(structures.length).toBeGreaterThanOrEqual(6);

    const studentUser = (
      await db.select().from(schema.users).where(eq(schema.users.email, 'student@demo.school'))
    )[0];
    const linkedStudent = (
      await db.select().from(schema.students).where(eq(schema.students.studentNumber, 'DEMO-0001'))
    )[0];
    expect(studentUser).toBeDefined();
    expect(linkedStudent?.userId).toBe(studentUser?.id);
  });

  it('reconciles assessments, payments, receipts, reversals, checkouts, and notifications', async () => {
    const students = await db
      .select()
      .from(schema.students)
      .where(eq(schema.students.studentNumber, 'DEMO-0002'));
    const partialStudent = students[0];
    expect(partialStudent).toBeDefined();

    const assessments = await db.select().from(schema.studentAssessments);
    const demoStudentIds = new Set(
      (
        await db
          .select({ id: schema.students.id })
          .from(schema.students)
          .where(inArray(schema.students.studentNumber, expectedDemoStudentNumbers))
      ).map((student) => student.id)
    );
    const demoAssessments = assessments.filter((assessment) =>
      demoStudentIds.has(assessment.studentId)
    );
    expect(demoAssessments).toHaveLength(expectedDemoStudentNumbers.length);
    const payments = await db.select().from(schema.payments);
    const receipts = await db.select().from(schema.receipts);
    const reversals = await db.select().from(schema.paymentReversals);
    const allocations = await db.select().from(schema.paymentAllocations);
    const checkouts = await db.select().from(schema.mockPaymentCheckouts);
    const notifications = await db.select().from(schema.notifications);
    const deliveries = await db.select().from(schema.notificationDeliveries);

    expect(new Set(payments.map((payment) => payment.paymentMethod))).toEqual(
      new Set(['CASH', 'BANK_DEPOSIT', 'GCASH', 'MOCK_ONLINE'])
    );
    expect(payments.filter((payment) => payment.status === 'REVERSED')).toHaveLength(1);
    expect(reversals).toHaveLength(1);
    expect(receipts).toHaveLength(payments.length);
    expect(new Set(receipts.map((receipt) => receipt.receiptNumber)).size).toBe(receipts.length);
    expect(receipts.filter((receipt) => receipt.status === 'VOIDED')).toHaveLength(1);
    expect(allocations.every((allocation) => allocation.amountCentavos > 0)).toBe(true);
    expect(checkouts.map((checkout) => checkout.status)).toEqual(
      expect.arrayContaining(['SUCCEEDED', 'FAILED', 'CANCELLED'])
    );
    expect(notifications.length).toBeGreaterThan(0);
    expect(deliveries.length).toBe(notifications.length);
    expect(deliveries.every((delivery) => delivery.status === 'SENT')).toBe(true);

    const partialAssessment = assessments.find(
      (assessment) => assessment.studentId === partialStudent?.id
    );
    expect(partialAssessment).toBeDefined();
    const partialEntries = await db
      .select({
        debitCentavos: schema.ledgerEntries.debitCentavos,
        creditCentavos: schema.ledgerEntries.creditCentavos,
        balanceCentavos: schema.ledgerEntries.balanceCentavos,
      })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.studentId, partialStudent!.id));
    expect(ledgerBalance(partialEntries)).toBeGreaterThan(0);
    expect(partialEntries.at(-1)?.balanceCentavos).toBe(50_000_00);

    const fullyPaidStudent = (
      await db.select().from(schema.students).where(eq(schema.students.studentNumber, 'DEMO-0003'))
    )[0];
    const fullyPaidEntries = await db
      .select({
        debitCentavos: schema.ledgerEntries.debitCentavos,
        creditCentavos: schema.ledgerEntries.creditCentavos,
      })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.studentId, fullyPaidStudent!.id));
    expect(ledgerBalance(fullyPaidEntries)).toBe(0);

    const unpaidStudent = (
      await db.select().from(schema.students).where(eq(schema.students.studentNumber, 'DEMO-0006'))
    )[0];
    const unpaidEntries = await db
      .select({
        debitCentavos: schema.ledgerEntries.debitCentavos,
        creditCentavos: schema.ledgerEntries.creditCentavos,
      })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.studentId, unpaidStudent!.id));
    expect(ledgerBalance(unpaidEntries)).toBe(70_000_00);

    const report = await ReportService.getCollectionReport(
      { from: '2026-08-01', to: '2026-08-31' },
      db
    );
    expect(report.totals.grossCollectionsCentavos).toBe(225_000_00);
    expect(report.totals.netCollectionsCentavos).toBe(210_000_00);
    expect(report.totals.reversedCentavos).toBe(15_000_00);
    expect((await ReportService.getOutstandingBalanceReport(db)).length).toBeGreaterThan(0);

    const parent = (
      await db.select().from(schema.users).where(eq(schema.users.email, 'parent@demo.school'))
    )[0];
    expect(parent).toBeDefined();
    const parentPaymentsPage = await listOwnedPaymentsPage(
      parent!.id,
      'PARENT',
      { pageSize: 1 },
      db
    );
    expect(parentPaymentsPage.items).toHaveLength(1);
    expect(parentPaymentsPage.pagination.total).toBeGreaterThan(1);
    const parentPaymentsPageTwo = await listOwnedPaymentsPage(
      parent!.id,
      'PARENT',
      { page: 2, pageSize: 1 },
      db
    );
    expect(parentPaymentsPageTwo.items[0]?.id).not.toBe(parentPaymentsPage.items[0]?.id);

    const collectionPage = await ReportService.getCollectionReportPage(
      { from: '2026-08-01', to: '2026-08-31' },
      1,
      1,
      db
    );
    expect(collectionPage.items).toHaveLength(1);
    expect(collectionPage.pagination.total).toBe(report.items.length);
    expect(collectionPage.totals).toEqual(report.totals);
    const collectionPageTwo = await ReportService.getCollectionReportPage(
      { from: '2026-08-01', to: '2026-08-31' },
      2,
      1,
      db
    );
    expect(collectionPageTwo.items[0]?.id).not.toBe(collectionPage.items[0]?.id);

    const outstandingPage = await ReportService.getOutstandingBalanceReportPage(1, 1, db);
    expect(outstandingPage.items).toHaveLength(1);
    expect(outstandingPage.pagination.total).toBeGreaterThan(1);
    expect(outstandingPage.totals.totalOutstandingBalanceCentavos).toBeGreaterThan(0);

    const reversalPage = await ReportService.getReversalReportPage(
      { from: '2026-08-01', to: '2026-08-31' },
      1,
      1,
      db
    );
    expect(reversalPage.items).toHaveLength(1);
    expect(reversalPage.pagination.total).toBe(1);
  });

  it('enforces ownership and duplicate assessment protection against persisted records', async () => {
    const parent = (
      await db.select().from(schema.users).where(eq(schema.users.email, 'parent@demo.school'))
    )[0];
    const studentUser = (
      await db.select().from(schema.users).where(eq(schema.users.email, 'student@demo.school'))
    )[0];
    const firstStudent = (
      await db.select().from(schema.students).where(eq(schema.students.studentNumber, 'DEMO-0001'))
    )[0];
    const secondStudent = (
      await db.select().from(schema.students).where(eq(schema.students.studentNumber, 'DEMO-0002'))
    )[0];
    expect(parent).toBeDefined();
    expect(studentUser).toBeDefined();
    expect(firstStudent).toBeDefined();
    expect(secondStudent).toBeDefined();

    const children = await PortalService.getParentChildren(parent!.id, db);
    expect(children.map((child) => child.studentNumber)).toEqual(
      expect.arrayContaining(['DEMO-0001', 'DEMO-0002'])
    );
    await expect(
      PortalService.verifyStudentAccess(studentUser!.id, firstStudent!.id, db)
    ).resolves.toBe(true);
    await expect(
      PortalService.verifyStudentAccess(studentUser!.id, secondStudent!.id, db)
    ).rejects.toThrow();

    const assessment = (
      await db
        .select()
        .from(schema.studentAssessments)
        .where(eq(schema.studentAssessments.studentId, firstStudent!.id))
    )[0];
    const structure = (
      await db
        .select()
        .from(schema.feeStructures)
        .where(eq(schema.feeStructures.id, assessment!.feeStructureId))
    )[0];
    await expect(
      AssessmentService.generateAssessment(
        {
          studentId: firstStudent!.id,
          schoolYearId: assessment!.schoolYearId,
          feeStructureId: structure!.id,
          actorUserId: parent!.id,
        },
        db
      )
    ).rejects.toThrow('already exists');
  });

  it('serializes concurrent payment attempts and preserves a succeeded checkout', async () => {
    const unpaidStudent = (
      await db.select().from(schema.students).where(eq(schema.students.studentNumber, 'DEMO-0006'))
    )[0];
    expect(unpaidStudent).toBeDefined();

    const idempotencyKeys = ['phase11-concurrency-a', 'phase11-concurrency-b'];
    const paymentResults = await Promise.allSettled(
      idempotencyKeys.map((idempotencyKey) =>
        PaymentService.recordPayment(
          {
            studentId: unpaidStudent!.id,
            amountCentavos: 4_000_000,
            paymentMethod: 'MOCK_ONLINE',
            idempotencyKey,
            skipNotifications: true,
          },
          db
        )
      )
    );

    try {
      expect(paymentResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(paymentResults.filter((result) => result.status === 'rejected')).toHaveLength(1);

      const createdPayments = await db
        .select({ id: schema.payments.id })
        .from(schema.payments)
        .where(inArray(schema.payments.idempotencyKey, idempotencyKeys));
      expect(createdPayments).toHaveLength(1);

      const entries = await db
        .select({
          debitCentavos: schema.ledgerEntries.debitCentavos,
          creditCentavos: schema.ledgerEntries.creditCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, unpaidStudent!.id));
      expect(ledgerBalance(entries)).toBe(70_000_00 - 4_000_000);

      const succeededCheckout = (
        await db
          .select()
          .from(schema.mockPaymentCheckouts)
          .where(eq(schema.mockPaymentCheckouts.status, 'SUCCEEDED'))
          .limit(1)
      )[0];
      expect(succeededCheckout).toBeDefined();

      const callbackInput = {
        paymentReference: succeededCheckout!.checkoutReference,
        eventId: 'phase11-conflict-event',
        idempotencyKey: 'phase11-conflict-key',
        status: 'CANCELLED' as const,
      };
      const callbackResult = await processMockCallback(callbackInput, db);
      expect(callbackResult).toMatchObject({
        status: 'failed',
        verificationStatus: 'SUCCESS',
        checkoutStatus: 'SUCCEEDED',
      });
      expect(callbackResult.error).toContain('financial history cannot change');
    } finally {
      const createdPayments = await db
        .select({ id: schema.payments.id })
        .from(schema.payments)
        .where(inArray(schema.payments.idempotencyKey, idempotencyKeys));
      const paymentIds = createdPayments.map((payment) => payment.id);

      if (paymentIds.length > 0) {
        const receipts = await db
          .select({ id: schema.receipts.id })
          .from(schema.receipts)
          .where(inArray(schema.receipts.paymentId, paymentIds));
        const entityIds = [...paymentIds, ...receipts.map((receipt) => receipt.id)];
        await db.transaction(async (tx) => {
          await tx.delete(schema.auditLogs).where(inArray(schema.auditLogs.entityId, entityIds));
          await tx
            .delete(schema.paymentReversals)
            .where(inArray(schema.paymentReversals.paymentId, paymentIds));
          await tx
            .delete(schema.paymentAllocations)
            .where(inArray(schema.paymentAllocations.paymentId, paymentIds));
          await tx.delete(schema.receipts).where(inArray(schema.receipts.paymentId, paymentIds));
          await tx.delete(schema.payments).where(inArray(schema.payments.id, paymentIds));
          await tx.delete(schema.ledgerEntries).where(
            inArray(
              schema.ledgerEntries.description,
              paymentIds.map((paymentId) => `Payment ${paymentId}`)
            )
          );
        });
      }

      await db
        .delete(schema.mockPaymentCallbackEvents)
        .where(eq(schema.mockPaymentCallbackEvents.eventId, 'phase11-conflict-event'));
    }
  });

  it('keeps the seeded payment-proof financial timeline deterministic and isolated', async () => {
    const submission = (
      await db
        .select()
        .from(schema.paymentSubmissions)
        .where(eq(schema.paymentSubmissions.idempotencyKey, 'seed-proof-gcash-approved'))
        .limit(1)
    )[0];
    expect(submission).toBeDefined();
    expect(submission?.status).toBe('APPROVED');
    expect(submission?.approvedPaymentId).toBeTruthy();

    const payment = (
      await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, submission!.approvedPaymentId!))
        .limit(1)
    )[0];
    expect(payment).toBeDefined();
    const receipt = (
      await db
        .select()
        .from(schema.receipts)
        .where(eq(schema.receipts.paymentId, payment!.id))
        .limit(1)
    )[0];
    expect(receipt).toBeDefined();

    const expectedTimestamp = DEMO_NOW.toISOString();
    expect(payment!.createdAt.toISOString()).toBe(expectedTimestamp);
    expect(payment!.updatedAt.toISOString()).toBe(expectedTimestamp);
    expect(receipt!.createdAt.toISOString()).toBe(expectedTimestamp);
    expect(receipt!.receiptNumber).toMatch(/-2026-\d{6}$/);

    const snapshot = receipt!.issuanceSnapshot as {
      issuedAt: string;
      receiptNumber: string;
    } | null;
    expect(snapshot?.issuedAt).toBe(expectedTimestamp);
    expect(snapshot?.receiptNumber).toBe(receipt!.receiptNumber);

    const allocations = await db
      .select()
      .from(schema.paymentAllocations)
      .where(eq(schema.paymentAllocations.paymentId, payment!.id));
    expect(allocations.length).toBeGreaterThan(0);
    expect(
      allocations.every((allocation) => allocation.createdAt.toISOString() === expectedTimestamp)
    ).toBe(true);

    const paymentLedger = await db
      .select()
      .from(schema.ledgerEntries)
      .where(
        and(
          eq(schema.ledgerEntries.studentId, payment!.studentId),
          eq(schema.ledgerEntries.entryType, 'PAYMENT'),
          eq(schema.ledgerEntries.description, `Payment ${payment!.id}`)
        )
      );
    expect(paymentLedger).toHaveLength(1);
    expect(paymentLedger[0]!.createdAt.toISOString()).toBe(expectedTimestamp);

    const report = await ReportService.getCollectionReport(
      { from: '2026-08-01', to: '2026-08-31' },
      db
    );
    expect(
      report.items.some(
        (item) => item.paymentMethod === 'GCASH' && item.referenceNumber === 'DEMO-GCASH-APPROVED'
      )
    ).toBe(true);

    const stableBefore = {
      submission: {
        id: submission!.id,
        createdAt: submission!.createdAt,
        updatedAt: submission!.updatedAt,
        reviewedAt: submission!.reviewedAt,
      },
      payment: {
        id: payment!.id,
        createdAt: payment!.createdAt,
        updatedAt: payment!.updatedAt,
      },
      receipt: {
        id: receipt!.id,
        receiptNumber: receipt!.receiptNumber,
        createdAt: receipt!.createdAt,
        issuanceSnapshot: receipt!.issuanceSnapshot,
      },
      allocations: allocations.map((allocation) => ({
        id: allocation.id,
        createdAt: allocation.createdAt,
      })),
      paymentLedger: paymentLedger.map((entry) => ({ id: entry.id, createdAt: entry.createdAt })),
    };

    const demoStudent = (
      await db
        .select()
        .from(schema.students)
        .where(eq(schema.students.studentNumber, 'DEMO-0001'))
        .limit(1)
    )[0];
    const assessment = (
      await db
        .select()
        .from(schema.studentAssessments)
        .where(eq(schema.studentAssessments.studentId, demoStudent!.id))
        .limit(1)
    )[0];
    const unrelatedCreatedAt = new Date('2025-01-01T00:00:00.000Z');
    const [unrelatedLedgerEntry] = await db
      .insert(schema.ledgerEntries)
      .values({
        studentId: demoStudent!.id,
        assessmentId: assessment!.id,
        entryType: 'PAYMENT',
        debitCentavos: 0,
        creditCentavos: 1,
        balanceCentavos: 1,
        description: 'Unrelated same-student payment ledger fixture',
        createdAt: unrelatedCreatedAt,
      })
      .returning();
    expect(unrelatedLedgerEntry).toBeDefined();

    try {
      await seedDemoData(db);

      const stableAfter = {
        submission: (
          await db
            .select({
              id: schema.paymentSubmissions.id,
              createdAt: schema.paymentSubmissions.createdAt,
              updatedAt: schema.paymentSubmissions.updatedAt,
              reviewedAt: schema.paymentSubmissions.reviewedAt,
            })
            .from(schema.paymentSubmissions)
            .where(eq(schema.paymentSubmissions.id, submission!.id))
        )[0],
        payment: (
          await db
            .select({
              id: schema.payments.id,
              createdAt: schema.payments.createdAt,
              updatedAt: schema.payments.updatedAt,
            })
            .from(schema.payments)
            .where(eq(schema.payments.id, payment!.id))
        )[0],
        receipt: (
          await db
            .select({
              id: schema.receipts.id,
              receiptNumber: schema.receipts.receiptNumber,
              createdAt: schema.receipts.createdAt,
              issuanceSnapshot: schema.receipts.issuanceSnapshot,
            })
            .from(schema.receipts)
            .where(eq(schema.receipts.id, receipt!.id))
        )[0],
        allocations: await db
          .select({
            id: schema.paymentAllocations.id,
            createdAt: schema.paymentAllocations.createdAt,
          })
          .from(schema.paymentAllocations)
          .where(eq(schema.paymentAllocations.paymentId, payment!.id)),
        paymentLedger: await db
          .select({ id: schema.ledgerEntries.id, createdAt: schema.ledgerEntries.createdAt })
          .from(schema.ledgerEntries)
          .where(eq(schema.ledgerEntries.id, paymentLedger[0]!.id)),
      };
      expect(stableAfter).toEqual(stableBefore);

      const unrelatedAfter = (
        await db
          .select({ createdAt: schema.ledgerEntries.createdAt })
          .from(schema.ledgerEntries)
          .where(eq(schema.ledgerEntries.id, unrelatedLedgerEntry!.id))
      )[0];
      expect(unrelatedAfter?.createdAt.toISOString()).toBe(unrelatedCreatedAt.toISOString());
    } finally {
      await db
        .delete(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.id, unrelatedLedgerEntry!.id));
    }
  });
});
