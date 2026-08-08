import { and, eq } from 'drizzle-orm';
import { createAuth } from '@/lib/auth/server';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { AssessmentService } from '@/server/services/assessment.service';
import { PortalService } from '@/server/services/portal.service';
import { ReportService } from '@/server/services/report.service';
import { describe, expect, it } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseContract = testDatabaseUrl ? describe : describe.skip;

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
    expect(students.filter((student) => student.studentNumber.startsWith('DEMO-'))).toHaveLength(
      20
    );
    expect(guardians.filter((guardian) => guardian.email.includes('demo.school'))).toHaveLength(10);
    expect(links).toHaveLength(20);
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
    expect(assessments).toHaveLength(20);
    const payments = await db.select().from(schema.payments);
    const receipts = await db.select().from(schema.receipts);
    const reversals = await db.select().from(schema.paymentReversals);
    const allocations = await db.select().from(schema.paymentAllocations);
    const checkouts = await db.select().from(schema.mockPaymentCheckouts);
    const notifications = await db.select().from(schema.notifications);
    const deliveries = await db.select().from(schema.notificationDeliveries);

    expect(new Set(payments.map((payment) => payment.paymentMethod))).toEqual(
      new Set(['CASH', 'BANK_DEPOSIT', 'MOCK_ONLINE'])
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
    expect(report.totals.grossCollectionsCentavos).toBe(175_000_00);
    expect(report.totals.netCollectionsCentavos).toBe(160_000_00);
    expect(report.totals.reversedCentavos).toBe(15_000_00);
    expect((await ReportService.getOutstandingBalanceReport(db)).length).toBeGreaterThan(0);
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
});
