import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { AssessmentService } from '@/server/services/assessment.service';
import {
  enqueueNotification,
  NotificationService,
  type EmailMessage,
  type EmailProvider,
} from '@/server/services/notification.service';
import { PaymentService } from '@/server/services/payment.service';
import { PortalService } from '@/server/services/portal.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseContract = testDatabaseUrl ? describe : describe.skip;

function ledgerBalance(entries: Array<{ debitCentavos: number; creditCentavos: number }>) {
  return entries.reduce(
    (balance, entry) => balance + entry.debitCentavos - entry.creditCentavos,
    0
  );
}

type FinancialFixture = {
  studentId: string;
  assessmentId: string;
};

async function createFinancialFixture(
  db: ReturnType<typeof getDb>,
  suffix: string,
  amountCentavos = 10_000_00
): Promise<FinancialFixture> {
  const schoolYear = (
    await db
      .select()
      .from(schema.schoolYears)
      .where(eq(schema.schoolYears.status, 'ACTIVE'))
      .limit(1)
  )[0];
  const grade = (
    await db.select().from(schema.gradeLevels).where(eq(schema.gradeLevels.code, 'G7')).limit(1)
  )[0];
  const section = (
    await db
      .select()
      .from(schema.sections)
      .where(
        and(eq(schema.sections.schoolYearId, schoolYear!.id), eq(schema.sections.code, 'G7-A'))
      )
      .limit(1)
  )[0];
  const feeStructure = (
    await db
      .select()
      .from(schema.feeStructures)
      .where(
        and(
          eq(schema.feeStructures.schoolYearId, schoolYear!.id),
          eq(schema.feeStructures.gradeLevelId, grade!.id),
          eq(schema.feeStructures.status, 'ACTIVE')
        )
      )
      .limit(1)
  )[0];
  const feeCategory = (await db.select().from(schema.feeCategories).limit(1))[0];
  const admin = (
    await db.select().from(schema.users).where(eq(schema.users.email, 'admin@demo.school')).limit(1)
  )[0];

  const [student] = await db
    .insert(schema.students)
    .values({
      studentNumber: `AUDIT-${suffix}`,
      firstName: 'Audit',
      lastName: 'Fixture',
      email: `audit.${suffix}@schoolfees.example.com`,
      gradeLevelId: grade!.id,
      sectionId: section!.id,
      schoolYearId: schoolYear!.id,
      status: 'ACTIVE',
    })
    .returning();
  const [assessment] = await db
    .insert(schema.studentAssessments)
    .values({
      studentId: student!.id,
      schoolYearId: schoolYear!.id,
      feeStructureId: feeStructure!.id,
      assessmentPeriod: 'ANNUAL',
      totalAmountCentavos: amountCentavos,
      status: 'POSTED',
    })
    .returning();
  const [item] = await db
    .insert(schema.assessmentItems)
    .values({
      assessmentId: assessment!.id,
      feeCategoryId: feeCategory!.id,
      name: 'Audit fixture fee',
      amountCentavos,
    })
    .returning();
  await db.insert(schema.ledgerEntries).values({
    studentId: student!.id,
    assessmentId: assessment!.id,
    entryType: 'ASSESSMENT',
    debitCentavos: amountCentavos,
    creditCentavos: 0,
    balanceCentavos: amountCentavos,
    description: `External audit fixture ${suffix}`,
  });

  expect(admin).toBeDefined();
  expect(item).toBeDefined();
  return { studentId: student!.id, assessmentId: assessment!.id };
}

async function cleanupFinancialFixture(db: ReturnType<typeof getDb>, fixture: FinancialFixture) {
  const payments = await db
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(eq(schema.payments.studentId, fixture.studentId));
  const paymentIds = payments.map((payment) => payment.id);
  const receipts =
    paymentIds.length === 0
      ? []
      : await db
          .select({ id: schema.receipts.id })
          .from(schema.receipts)
          .where(inArray(schema.receipts.paymentId, paymentIds));
  const adjustments = await db
    .select({ id: schema.adjustments.id })
    .from(schema.adjustments)
    .where(eq(schema.adjustments.studentId, fixture.studentId));
  const entityIds = [
    fixture.assessmentId,
    ...paymentIds,
    ...receipts.map((receipt) => receipt.id),
    ...adjustments.map((adjustment) => adjustment.id),
  ];

  await db.transaction(async (tx) => {
    if (entityIds.length > 0) {
      await tx.delete(schema.auditLogs).where(inArray(schema.auditLogs.entityId, entityIds));
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
    await tx.delete(schema.adjustments).where(eq(schema.adjustments.studentId, fixture.studentId));
    await tx
      .delete(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.studentId, fixture.studentId));
    await tx
      .delete(schema.assessmentItems)
      .where(eq(schema.assessmentItems.assessmentId, fixture.assessmentId));
    await tx
      .delete(schema.studentAssessments)
      .where(eq(schema.studentAssessments.id, fixture.assessmentId));
    await tx.delete(schema.students).where(eq(schema.students.id, fixture.studentId));
  });
}

class BlockingEmailProvider implements EmailProvider {
  readonly channel = 'EMAIL' as const;
  sendCount = 0;
  private startedResolve!: () => void;
  private releaseResolve!: () => void;
  private readonly started = new Promise<void>((resolve) => {
    this.startedResolve = resolve;
  });
  private readonly release = new Promise<void>((resolve) => {
    this.releaseResolve = resolve;
  });

  async waitUntilSendStarts() {
    await this.started;
  }

  releaseSend() {
    this.releaseResolve();
  }

  async send(_message: EmailMessage) {
    this.sendCount += 1;
    this.startedResolve();
    await this.release;
    return { providerMessageId: `audit-message-${this.sendCount}` };
  }
}

class FailingEmailProvider implements EmailProvider {
  readonly channel = 'EMAIL' as const;

  async send(_message: EmailMessage): Promise<never> {
    throw new Error('Audit fixture provider failure.');
  }
}

databaseContract('external audit round 1 regressions', () => {
  const db = getDb(testDatabaseUrl);

  it('serializes competing credits, payment/credit, debit/payment, and reversal/payment mutations', async () => {
    const admin = (
      await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@demo.school'))
        .limit(1)
    )[0];
    expect(admin).toBeDefined();
    const fixtures: FinancialFixture[] = [];

    try {
      const creditFixture = await createFinancialFixture(db, randomUUID());
      fixtures.push(creditFixture);
      const creditResults = await Promise.allSettled([
        AssessmentService.applyAdjustment(
          {
            assessmentId: creditFixture.assessmentId,
            studentId: creditFixture.studentId,
            type: 'CREDIT',
            amountCentavos: 80_000_0,
            reason: 'Concurrent credit A',
            actorUserId: admin!.id,
          },
          db
        ),
        AssessmentService.applyAdjustment(
          {
            assessmentId: creditFixture.assessmentId,
            studentId: creditFixture.studentId,
            type: 'CREDIT',
            amountCentavos: 80_000_0,
            reason: 'Concurrent credit B',
            actorUserId: admin!.id,
          },
          db
        ),
      ]);
      expect(creditResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(creditResults.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const creditEntries = await db
        .select({
          debitCentavos: schema.ledgerEntries.debitCentavos,
          creditCentavos: schema.ledgerEntries.creditCentavos,
          balanceCentavos: schema.ledgerEntries.balanceCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, creditFixture.studentId));
      expect(ledgerBalance(creditEntries)).toBe(20_000_0);
      expect(creditEntries.every((entry) => entry.balanceCentavos >= 0)).toBe(true);

      const paymentCreditFixture = await createFinancialFixture(db, randomUUID());
      fixtures.push(paymentCreditFixture);
      const paymentCreditResults = await Promise.allSettled([
        PaymentService.recordPayment(
          {
            studentId: paymentCreditFixture.studentId,
            amountCentavos: 60_000_0,
            paymentMethod: 'CASH',
            referenceNumber: `AUDIT-PAY-${randomUUID()}`,
            idempotencyKey: `audit-pay-${randomUUID()}`,
            processedByUserId: admin!.id,
            skipNotifications: true,
          },
          db
        ),
        AssessmentService.applyAdjustment(
          {
            assessmentId: paymentCreditFixture.assessmentId,
            studentId: paymentCreditFixture.studentId,
            type: 'CREDIT',
            amountCentavos: 60_000_0,
            reason: 'Concurrent payment credit',
            actorUserId: admin!.id,
          },
          db
        ),
      ]);
      expect(paymentCreditResults.filter((result) => result.status === 'fulfilled')).toHaveLength(
        1
      );
      expect(paymentCreditResults.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const paymentCreditEntries = await db
        .select({
          debitCentavos: schema.ledgerEntries.debitCentavos,
          creditCentavos: schema.ledgerEntries.creditCentavos,
          balanceCentavos: schema.ledgerEntries.balanceCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, paymentCreditFixture.studentId));
      expect(ledgerBalance(paymentCreditEntries)).toBe(40_000_0);
      expect(paymentCreditEntries.every((entry) => entry.balanceCentavos >= 0)).toBe(true);

      const debitPaymentFixture = await createFinancialFixture(db, randomUUID());
      fixtures.push(debitPaymentFixture);
      const debitPaymentResults = await Promise.allSettled([
        AssessmentService.applyAdjustment(
          {
            assessmentId: debitPaymentFixture.assessmentId,
            studentId: debitPaymentFixture.studentId,
            type: 'DEBIT',
            amountCentavos: 20_000_0,
            reason: 'Concurrent debit adjustment',
            actorUserId: admin!.id,
          },
          db
        ),
        PaymentService.recordPayment(
          {
            studentId: debitPaymentFixture.studentId,
            amountCentavos: 50_000_0,
            paymentMethod: 'BANK_DEPOSIT',
            referenceNumber: `AUDIT-DEBIT-${randomUUID()}`,
            idempotencyKey: `audit-debit-${randomUUID()}`,
            processedByUserId: admin!.id,
            skipNotifications: true,
          },
          db
        ),
      ]);
      expect(debitPaymentResults.every((result) => result.status === 'fulfilled')).toBe(true);
      const debitPaymentEntries = await db
        .select({
          debitCentavos: schema.ledgerEntries.debitCentavos,
          creditCentavos: schema.ledgerEntries.creditCentavos,
          balanceCentavos: schema.ledgerEntries.balanceCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, debitPaymentFixture.studentId));
      expect(ledgerBalance(debitPaymentEntries)).toBe(70_000_0);
      const mutationSnapshots = debitPaymentEntries
        .slice(1)
        .map((entry) => entry.balanceCentavos)
        .sort((a, b) => a - b);
      expect([
        [5_000_0, 7_000_0],
        [7_000_0, 12_000_0],
      ]).toContainEqual(mutationSnapshots);
      expect(debitPaymentEntries.every((entry) => entry.balanceCentavos >= 0)).toBe(true);

      const reconciliationFixture = await createFinancialFixture(db, randomUUID());
      fixtures.push(reconciliationFixture);
      const originalPayment = await PaymentService.recordPayment(
        {
          studentId: reconciliationFixture.studentId,
          amountCentavos: 20_000_0,
          paymentMethod: 'CASH',
          referenceNumber: `AUDIT-ORIGINAL-${randomUUID()}`,
          idempotencyKey: `audit-original-${randomUUID()}`,
          processedByUserId: admin!.id,
          skipNotifications: true,
        },
        db
      );
      const reconciliationResults = await Promise.allSettled([
        PaymentService.reversePayment(
          {
            paymentId: originalPayment.id,
            reason: 'Concurrent reconciliation reversal',
            reversedByUserId: admin!.id,
          },
          db
        ),
        PaymentService.recordPayment(
          {
            studentId: reconciliationFixture.studentId,
            amountCentavos: 30_000_0,
            paymentMethod: 'CASH',
            referenceNumber: `AUDIT-RECONCILE-${randomUUID()}`,
            idempotencyKey: `audit-reconcile-${randomUUID()}`,
            processedByUserId: admin!.id,
            skipNotifications: true,
          },
          db
        ),
      ]);
      expect(reconciliationResults.every((result) => result.status === 'fulfilled')).toBe(true);
      const reconciliationEntries = await db
        .select({
          debitCentavos: schema.ledgerEntries.debitCentavos,
          creditCentavos: schema.ledgerEntries.creditCentavos,
          balanceCentavos: schema.ledgerEntries.balanceCentavos,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.studentId, reconciliationFixture.studentId));
      expect(ledgerBalance(reconciliationEntries)).toBe(70_000_0);
      expect(reconciliationEntries.every((entry) => entry.balanceCentavos >= 0)).toBe(true);
    } finally {
      for (const fixture of fixtures.reverse()) await cleanupFinancialFixture(db, fixture);
    }
  });

  it('allocates unique configured-prefix receipts under concurrent payment creation', async () => {
    const admin = (
      await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@demo.school'))
        .limit(1)
    )[0];
    const settings = (await db.select().from(schema.schoolSettings).limit(1))[0];
    expect(admin).toBeDefined();
    expect(settings).toBeDefined();
    const fixture = await createFinancialFixture(db, randomUUID());
    const originalPrefix = settings!.receiptPrefix;

    try {
      await db
        .update(schema.schoolSettings)
        .set({ receiptPrefix: 'AUDIT' })
        .where(eq(schema.schoolSettings.id, settings!.id));
      const results = await Promise.all(
        [1, 2, 3].map((index) =>
          PaymentService.recordPayment(
            {
              studentId: fixture.studentId,
              amountCentavos: 1_000_0,
              paymentMethod: 'CASH',
              referenceNumber: `AUDIT-RECEIPT-${index}-${randomUUID()}`,
              idempotencyKey: `audit-receipt-${index}-${randomUUID()}`,
              processedByUserId: admin!.id,
              skipNotifications: true,
            },
            db
          )
        )
      );
      const receiptNumbers = results.map((payment) => payment.receipt?.receiptNumber ?? '');
      expect(new Set(receiptNumbers).size).toBe(3);
      expect(receiptNumbers.every((number) => /^AUDIT-2026-\d{6}$/.test(number))).toBe(true);
    } finally {
      await db
        .update(schema.schoolSettings)
        .set({ receiptPrefix: originalPrefix })
        .where(eq(schema.schoolSettings.id, settings!.id));
      await cleanupFinancialFixture(db, fixture);
    }
  });

  it('reports net parent payments across normal, reversed, and multiple child ledgers', async () => {
    const parent = (
      await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'parent@demo.school'))
        .limit(1)
    )[0];
    const guardian = (
      await db
        .select()
        .from(schema.guardians)
        .where(eq(schema.guardians.userId, parent!.id))
        .limit(1)
    )[0];
    const schoolYear = (
      await db
        .select()
        .from(schema.schoolYears)
        .where(eq(schema.schoolYears.status, 'ACTIVE'))
        .limit(1)
    )[0];
    expect(parent).toBeDefined();
    expect(guardian).toBeDefined();
    const studentIds: string[] = [];
    try {
      for (const [index, ledgerEntries] of [
        [
          {
            entryType: 'ASSESSMENT' as const,
            debitCentavos: 1_000_00,
            creditCentavos: 0,
            balanceCentavos: 1_000_00,
          },
          {
            entryType: 'PAYMENT' as const,
            debitCentavos: 0,
            creditCentavos: 200_00,
            balanceCentavos: 800_00,
          },
        ],
        [
          {
            entryType: 'ASSESSMENT' as const,
            debitCentavos: 1_000_00,
            creditCentavos: 0,
            balanceCentavos: 1_000_00,
          },
          {
            entryType: 'PAYMENT' as const,
            debitCentavos: 0,
            creditCentavos: 200_00,
            balanceCentavos: 800_00,
          },
          {
            entryType: 'REVERSAL' as const,
            debitCentavos: 200_00,
            creditCentavos: 0,
            balanceCentavos: 1_000_00,
          },
        ],
        [
          {
            entryType: 'ASSESSMENT' as const,
            debitCentavos: 1_000_00,
            creditCentavos: 0,
            balanceCentavos: 1_000_00,
          },
          {
            entryType: 'PAYMENT' as const,
            debitCentavos: 0,
            creditCentavos: 200_00,
            balanceCentavos: 800_00,
          },
          {
            entryType: 'PAYMENT' as const,
            debitCentavos: 0,
            creditCentavos: 300_00,
            balanceCentavos: 500_00,
          },
          {
            entryType: 'REVERSAL' as const,
            debitCentavos: 200_00,
            creditCentavos: 0,
            balanceCentavos: 700_00,
          },
        ],
      ].entries()) {
        const [student] = await db
          .insert(schema.students)
          .values({
            studentNumber: `AUDIT-PARENT-${index}-${randomUUID()}`,
            firstName: 'Parent',
            lastName: `Fixture ${index}`,
            email: `audit.parent.${index}.${randomUUID()}@schoolfees.example.com`,
            schoolYearId: schoolYear!.id,
            status: 'ACTIVE',
          })
          .returning();
        studentIds.push(student!.id);
        await db.insert(schema.guardianStudents).values({
          guardianId: guardian!.id,
          studentId: student!.id,
          isPrimary: false,
        });
        await db.insert(schema.ledgerEntries).values(
          ledgerEntries.map((entry) => ({
            ...entry,
            studentId: student!.id,
            description: `Parent audit ${index}`,
          }))
        );
      }

      const children = await PortalService.getParentChildren(parent!.id, db);
      const childByNumber = new Map(children.map((child) => [child.studentNumber, child]));
      const auditChildren = children.filter((child) => studentIds.includes(child.studentId));
      expect(auditChildren).toHaveLength(3);
      expect(auditChildren.map((child) => child.totalPaidCentavos).sort((a, b) => a - b)).toEqual([
        0, 200_00, 300_00,
      ]);
      expect(childByNumber.size).toBeGreaterThanOrEqual(5);
    } finally {
      await db
        .delete(schema.ledgerEntries)
        .where(inArray(schema.ledgerEntries.studentId, studentIds));
      await db
        .delete(schema.guardianStudents)
        .where(inArray(schema.guardianStudents.studentId, studentIds));
      await db.delete(schema.students).where(inArray(schema.students.id, studentIds));
    }
  });

  it('atomically claims one manual notification retry and retains attempt history', async () => {
    const admin = (
      await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@demo.school'))
        .limit(1)
    )[0];
    expect(admin).toBeDefined();
    const suffix = randomUUID();
    const first = await enqueueNotification(
      {
        userId: admin!.id,
        type: 'PAYMENT_SUCCESSFUL',
        dedupeKey: `audit-notification-${suffix}`,
        title: 'Audit retry fixture',
        body: 'Audit retry fixture body',
      },
      db,
      new FailingEmailProvider()
    );
    await NotificationService.retryNotification(
      first.notification.id,
      db,
      new FailingEmailProvider()
    );

    const blockedProvider = new BlockingEmailProvider();
    const firstRetry = NotificationService.retryNotification(
      first.notification.id,
      db,
      blockedProvider
    );
    await blockedProvider.waitUntilSendStarts();
    const secondRetry = NotificationService.retryNotification(
      first.notification.id,
      db,
      blockedProvider
    );
    blockedProvider.releaseSend();
    await Promise.all([firstRetry, secondRetry]);

    const delivery = (
      await db
        .select()
        .from(schema.notificationDeliveries)
        .where(eq(schema.notificationDeliveries.notificationId, first.notification.id))
    )[0];
    const attempts = await db
      .select()
      .from(schema.notificationDeliveryAttempts)
      .where(eq(schema.notificationDeliveryAttempts.deliveryId, delivery!.id));
    expect(blockedProvider.sendCount).toBe(1);
    expect(delivery?.status).toBe('SENT');
    expect(delivery?.attemptCount).toBe(3);
    expect(attempts).toHaveLength(3);
    expect(attempts.filter((attempt) => attempt.status === 'FAILED')).toHaveLength(2);

    await db.delete(schema.notifications).where(eq(schema.notifications.id, first.notification.id));
  });
});
