import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { getOrCreateSchoolSettings } from '@/server/services/administration.service';
import {
  MAX_PAYMENT_PROOF_BYTES,
  approvePaymentSubmission,
  createPaymentSubmission,
  getPaymentDestinationOptions,
  getPaymentProof,
  getPaymentSubmission,
  listParentPaymentSubmissions,
  listPaymentSubmissions,
  rejectPaymentSubmission,
  type PaymentProofInput,
} from '@/server/services/payment-submission.service';
import { ConsoleEmailProvider } from '@/server/services/notification.service';
import { PaymentService } from '@/server/services/payment.service';
import { fictionalPaymentProof } from '../fixtures/fictional-payment-proof';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseContract = testDatabaseUrl ? describe.sequential : describe.skip;

type PaymentFixture = {
  studentId: string;
  studentUserId: string;
  parentUserId: string;
  assessmentId: string;
  assessmentItemId: string;
};

function ledgerBalance(entries: Array<{ debitCentavos: number; creditCentavos: number }>) {
  return entries.reduce(
    (balance, entry) => balance + entry.debitCentavos - entry.creditCentavos,
    0
  );
}

function proofInput(overrides: Partial<PaymentProofInput> = {}): PaymentProofInput {
  return {
    mimeType: 'image/png',
    originalFileName: 'fictional-payment-proof.png',
    data: Buffer.from(fictionalPaymentProof),
    ...overrides,
  };
}

databaseContract('manual GCash and Maya payment verification PostgreSQL contract', () => {
  let db: DatabaseInstance;
  let activeSchoolYearId: string;
  let activeGradeLevelId: string;
  let activeFeeStructureId: string;
  let feeCategoryId: string;
  let adminUserId: string;
  let financeUserId: string;
  let unrelatedParentUserId: string;
  let originalSettings: {
    gcashEnabled: boolean;
    gcashAccountName: string | null;
    gcashAccountNumber: string | null;
    mayaEnabled: boolean;
    mayaAccountName: string | null;
    mayaAccountNumber: string | null;
  };

  const createdUserIds: string[] = [];
  const createdGuardianIds: string[] = [];
  const createdGuardianStudentIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdAssessmentIds: string[] = [];
  const createdAssessmentItemIds: string[] = [];
  const createdSubmissionIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdReceiptIds: string[] = [];
  const notificationEntityIds = new Set<string>();

  beforeAll(async () => {
    db = getDb(testDatabaseUrl!);
    const [schoolYear] = await db
      .select({ id: schema.schoolYears.id })
      .from(schema.schoolYears)
      .where(eq(schema.schoolYears.status, 'ACTIVE'))
      .orderBy(asc(schema.schoolYears.startDate))
      .limit(1);
    const [gradeLevel] = await db
      .select({ id: schema.gradeLevels.id })
      .from(schema.gradeLevels)
      .orderBy(asc(schema.gradeLevels.displayOrder))
      .limit(1);
    const [feeStructure] = await db
      .select({
        id: schema.feeStructures.id,
        schoolYearId: schema.feeStructures.schoolYearId,
        gradeLevelId: schema.feeStructures.gradeLevelId,
      })
      .from(schema.feeStructures)
      .innerJoin(schema.schoolYears, eq(schema.schoolYears.id, schema.feeStructures.schoolYearId))
      .where(
        and(eq(schema.feeStructures.status, 'ACTIVE'), eq(schema.schoolYears.status, 'ACTIVE'))
      )
      .orderBy(asc(schema.feeStructures.createdAt))
      .limit(1);
    const [feeCategory] = await db
      .select({ id: schema.feeCategories.id })
      .from(schema.feeCategories)
      .where(eq(schema.feeCategories.status, 'ACTIVE'))
      .orderBy(asc(schema.feeCategories.createdAt))
      .limit(1);
    const users = await db
      .select({ id: schema.users.id, email: schema.users.email, role: schema.users.role })
      .from(schema.users)
      .where(inArray(schema.users.email, ['admin@demo.school', 'finance@demo.school']));
    const admin = users.find((user) => user.email === 'admin@demo.school');
    const finance = users.find((user) => user.email === 'finance@demo.school');
    if (!schoolYear || !gradeLevel || !feeStructure || !feeCategory || !admin || !finance) {
      throw new Error('Seeded academic, fee, admin, and finance fixtures are required.');
    }
    activeSchoolYearId = schoolYear.id;
    activeGradeLevelId = gradeLevel.id;
    activeFeeStructureId = feeStructure.id;
    feeCategoryId = feeCategory.id;
    adminUserId = admin.id;
    financeUserId = finance.id;

    const settings = await getOrCreateSchoolSettings(db);
    originalSettings = {
      gcashEnabled: settings.gcashEnabled,
      gcashAccountName: settings.gcashAccountName,
      gcashAccountNumber: settings.gcashAccountNumber,
      mayaEnabled: settings.mayaEnabled,
      mayaAccountName: settings.mayaAccountName,
      mayaAccountNumber: settings.mayaAccountNumber,
    };
    await db
      .update(schema.schoolSettings)
      .set({
        gcashEnabled: true,
        gcashAccountName: 'Phase 2 Fictional GCash Account',
        gcashAccountNumber: '0999 111 2222',
        mayaEnabled: true,
        mayaAccountName: 'Phase 2 Fictional Maya Account',
        mayaAccountNumber: '0998 333 4444',
        updatedAt: new Date(),
      })
      .where(eq(schema.schoolSettings.singletonKey, 'default'));

    unrelatedParentUserId = randomUUID();
    await db.insert(schema.users).values({
      id: unrelatedParentUserId,
      name: 'Phase 2 Unrelated Parent',
      email: `phase-two-unrelated-parent-${unrelatedParentUserId}@example.com`,
      role: 'PARENT',
      active: true,
      emailVerified: true,
    });
    createdUserIds.push(unrelatedParentUserId);
  });

  afterAll(async () => {
    if (!db) return;
    if (createdPaymentIds.length > 0) {
      const receipts = await db
        .select({ id: schema.receipts.id })
        .from(schema.receipts)
        .where(inArray(schema.receipts.paymentId, createdPaymentIds));
      createdReceiptIds.push(...receipts.map((receipt) => receipt.id));
    }
    const entityIds = [
      ...new Set([
        ...notificationEntityIds,
        ...createdSubmissionIds,
        ...createdPaymentIds,
        ...createdReceiptIds,
      ]),
    ];
    if (entityIds.length > 0) {
      const notifications = await db
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(inArray(schema.notifications.entityId, entityIds));
      if (notifications.length > 0) {
        await db.delete(schema.notifications).where(
          inArray(
            schema.notifications.id,
            notifications.map((row) => row.id)
          )
        );
      }
    }

    if (createdSubmissionIds.length > 0) {
      await db
        .delete(schema.paymentSubmissionProofs)
        .where(inArray(schema.paymentSubmissionProofs.submissionId, createdSubmissionIds));
      await db
        .delete(schema.paymentSubmissions)
        .where(inArray(schema.paymentSubmissions.id, createdSubmissionIds));
    }
    if (createdPaymentIds.length > 0) {
      await db
        .delete(schema.auditLogs)
        .where(inArray(schema.auditLogs.entityId, [...createdPaymentIds, ...createdReceiptIds]));
      await db
        .delete(schema.paymentReversals)
        .where(inArray(schema.paymentReversals.paymentId, createdPaymentIds));
      await db
        .delete(schema.paymentAllocations)
        .where(inArray(schema.paymentAllocations.paymentId, createdPaymentIds));
      await db.delete(schema.receipts).where(inArray(schema.receipts.paymentId, createdPaymentIds));
      await db.delete(schema.payments).where(inArray(schema.payments.id, createdPaymentIds));
    }
    if (createdSubmissionIds.length > 0) {
      await db
        .delete(schema.auditLogs)
        .where(inArray(schema.auditLogs.entityId, createdSubmissionIds));
    }
    if (createdStudentIds.length > 0) {
      await db
        .delete(schema.ledgerEntries)
        .where(inArray(schema.ledgerEntries.studentId, createdStudentIds));
    }
    if (createdAssessmentItemIds.length > 0) {
      await db
        .delete(schema.assessmentItems)
        .where(inArray(schema.assessmentItems.id, createdAssessmentItemIds));
    }
    if (createdAssessmentIds.length > 0) {
      await db
        .delete(schema.studentAssessments)
        .where(inArray(schema.studentAssessments.id, createdAssessmentIds));
    }
    if (createdGuardianStudentIds.length > 0) {
      await db
        .delete(schema.guardianStudents)
        .where(inArray(schema.guardianStudents.id, createdGuardianStudentIds));
    }
    if (createdGuardianIds.length > 0) {
      await db.delete(schema.guardians).where(inArray(schema.guardians.id, createdGuardianIds));
    }
    if (createdStudentIds.length > 0) {
      await db.delete(schema.students).where(inArray(schema.students.id, createdStudentIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.userId, createdUserIds));
      await db.delete(schema.users).where(inArray(schema.users.id, createdUserIds));
    }
    await db
      .update(schema.schoolSettings)
      .set({ ...originalSettings, updatedAt: new Date() })
      .where(eq(schema.schoolSettings.singletonKey, 'default'));
  });

  async function createFixture(balanceCentavos = 100_000): Promise<PaymentFixture> {
    const suffix = randomUUID();
    const studentUserId = randomUUID();
    const parentUserId = randomUUID();
    await db.insert(schema.users).values([
      {
        id: studentUserId,
        name: `Phase 2 Student ${suffix}`,
        email: `phase-two-student-${suffix}@example.com`,
        role: 'STUDENT',
        active: true,
        emailVerified: true,
      },
      {
        id: parentUserId,
        name: `Phase 2 Parent ${suffix}`,
        email: `phase-two-parent-${suffix}@example.com`,
        role: 'PARENT',
        active: true,
        emailVerified: true,
      },
    ]);
    createdUserIds.push(studentUserId, parentUserId);

    const [student] = await db
      .insert(schema.students)
      .values({
        studentNumber: `PHASE2-${suffix.slice(0, 12)}`,
        firstName: 'Phase 2',
        lastName: `Student ${suffix.slice(0, 8)}`,
        email: `phase-two-student-${suffix}@example.com`,
        userId: studentUserId,
        gradeLevelId: activeGradeLevelId,
        sectionId: null,
        schoolYearId: activeSchoolYearId,
        status: 'ACTIVE',
      })
      .returning({ id: schema.students.id });
    if (!student) throw new Error('Phase 2 student fixture could not be created.');
    createdStudentIds.push(student.id);

    const [guardian] = await db
      .insert(schema.guardians)
      .values({
        userId: parentUserId,
        firstName: 'Phase 2',
        lastName: 'Parent',
        email: `phase-two-parent-${suffix}@example.com`,
        phone: '+63 900 222 3333',
        relationship: 'Parent',
        address: 'Fictional Phase 2 verification address',
      })
      .returning({ id: schema.guardians.id });
    if (!guardian) throw new Error('Phase 2 guardian fixture could not be created.');
    createdGuardianIds.push(guardian.id);
    const [guardianStudent] = await db
      .insert(schema.guardianStudents)
      .values({ guardianId: guardian.id, studentId: student.id, isPrimary: true })
      .returning({ id: schema.guardianStudents.id });
    if (!guardianStudent) throw new Error('Phase 2 guardian link could not be created.');
    createdGuardianStudentIds.push(guardianStudent.id);

    const [assessment] = await db
      .insert(schema.studentAssessments)
      .values({
        studentId: student.id,
        schoolYearId: activeSchoolYearId,
        feeStructureId: activeFeeStructureId,
        assessmentPeriod: 'ANNUAL',
        totalAmountCentavos: balanceCentavos,
        status: 'POSTED',
        dueDate: '2026-12-31',
      })
      .returning({ id: schema.studentAssessments.id });
    if (!assessment) throw new Error('Phase 2 assessment fixture could not be created.');
    createdAssessmentIds.push(assessment.id);
    const [item] = await db
      .insert(schema.assessmentItems)
      .values({
        assessmentId: assessment.id,
        feeCategoryId,
        name: 'Phase 2 fictional tuition',
        amountCentavos: balanceCentavos,
      })
      .returning({ id: schema.assessmentItems.id });
    if (!item) throw new Error('Phase 2 assessment item fixture could not be created.');
    createdAssessmentItemIds.push(item.id);
    await db.insert(schema.ledgerEntries).values({
      studentId: student.id,
      assessmentId: assessment.id,
      entryType: 'ASSESSMENT',
      debitCentavos: balanceCentavos,
      creditCentavos: 0,
      balanceCentavos,
      description: 'Phase 2 fictional assessment',
    });

    return {
      studentId: student.id,
      studentUserId,
      parentUserId,
      assessmentId: assessment.id,
      assessmentItemId: item.id,
    };
  }

  async function submit(
    fixture: PaymentFixture,
    input: Partial<{
      paymentChannel: 'GCASH' | 'MAYA';
      amountCentavos: number;
      referenceNumber: string;
      idempotencyKey: string;
      paidAt: string;
    }> = {},
    proof: PaymentProofInput = proofInput()
  ) {
    const submission = await createPaymentSubmission(
      {
        studentId: fixture.studentId,
        paymentChannel: input.paymentChannel ?? 'GCASH',
        amountCentavos: input.amountCentavos ?? 40_000,
        referenceNumber: input.referenceNumber ?? `P2-${randomUUID()}`,
        paidAt: input.paidAt ?? '2026-08-11T08:30:00+08:00',
        idempotencyKey: input.idempotencyKey ?? `phase-two-${randomUUID()}`,
        proof,
      },
      fixture.parentUserId,
      db,
      new ConsoleEmailProvider()
    );
    createdSubmissionIds.push(submission.id);
    notificationEntityIds.add(submission.id);
    return submission;
  }

  async function paymentRows(studentId: string) {
    return db.select().from(schema.payments).where(eq(schema.payments.studentId, studentId));
  }

  async function balanceRows(studentId: string) {
    return db
      .select({
        debitCentavos: schema.ledgerEntries.debitCentavos,
        creditCentavos: schema.ledgerEntries.creditCentavos,
      })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.studentId, studentId));
  }

  async function notificationsFor(entityId: string) {
    return db
      .select({ type: schema.notifications.type, userId: schema.notifications.userId })
      .from(schema.notifications)
      .where(eq(schema.notifications.entityId, entityId));
  }

  it('exposes configured destinations and persists a pending proof without financial writes', async () => {
    const fixture = await createFixture();
    const options = await getPaymentDestinationOptions(db);
    expect(options).toEqual({
      gcash: {
        accountName: 'Phase 2 Fictional GCash Account',
        accountNumber: '0999 111 2222',
      },
      maya: {
        accountName: 'Phase 2 Fictional Maya Account',
        accountNumber: '0998 333 4444',
      },
    });

    const input = {
      paymentChannel: 'GCASH' as const,
      amountCentavos: 40_000,
      referenceNumber: 'GC-ASH 1001',
      idempotencyKey: `phase-two-replay-${randomUUID()}`,
      paidAt: '2026-08-11T08:30:00+08:00',
    };
    const submission = await submit(fixture, input);
    expect(submission).toMatchObject({
      status: 'PENDING_VERIFICATION',
      paymentChannel: 'GCASH',
      referenceNumber: 'GC-ASH 1001',
      amountCentavos: 40_000,
      currentBalanceCentavos: 100_000,
      proofMimeType: 'image/png',
      proofSizeBytes: fictionalPaymentProof.length,
    });
    expect(submission.paymentDestination).toEqual(options.gcash);

    const settingsBeforeChange = await getOrCreateSchoolSettings(db);
    await db
      .update(schema.schoolSettings)
      .set({
        gcashAccountName: 'Phase 2 Changed GCash Account',
        gcashAccountNumber: '0999 999 9999',
        updatedAt: new Date(),
      })
      .where(eq(schema.schoolSettings.singletonKey, 'default'));
    try {
      expect((await getPaymentSubmission(submission.id, db)).paymentDestination).toEqual(
        options.gcash
      );
      expect(
        (await listParentPaymentSubmissions(fixture.parentUserId, {}, db)).items.find(
          (row) => row.id === submission.id
        )?.paymentDestination
      ).toEqual(options.gcash);
    } finally {
      await db
        .update(schema.schoolSettings)
        .set({
          gcashAccountName: settingsBeforeChange.gcashAccountName,
          gcashAccountNumber: settingsBeforeChange.gcashAccountNumber,
          updatedAt: new Date(),
        })
        .where(eq(schema.schoolSettings.singletonKey, 'default'));
    }

    await expect(
      db
        .update(schema.paymentSubmissions)
        .set({ reviewedAt: new Date() })
        .where(eq(schema.paymentSubmissions.id, submission.id))
    ).rejects.toThrow();
    await expect(
      db
        .update(schema.paymentSubmissions)
        .set({ status: 'APPROVED' })
        .where(eq(schema.paymentSubmissions.id, submission.id))
    ).rejects.toThrow();

    const proof = await getPaymentProof(
      submission.id,
      { id: fixture.parentUserId, role: 'PARENT' },
      db
    );
    expect(Buffer.from(proof.data)).toEqual(fictionalPaymentProof);
    expect(proof.originalFileName).toBe('fictional-payment-proof.png');
    expect(await paymentRows(fixture.studentId)).toHaveLength(0);
    expect(ledgerBalance(await balanceRows(fixture.studentId))).toBe(100_000);

    const parentRows = await listParentPaymentSubmissions(fixture.parentUserId, {}, db);
    expect(parentRows.items.map((row) => row.id)).toContain(submission.id);
    const pendingRows = await listPaymentSubmissions({ status: 'PENDING_VERIFICATION' }, db);
    expect(pendingRows.items.map((row) => row.id)).toContain(submission.id);
    const firstQueuePage = await listPaymentSubmissions(
      { status: 'PENDING_VERIFICATION', page: 1, pageSize: 1 },
      db
    );
    expect(firstQueuePage.page).toBe(1);
    expect(firstQueuePage.pageSize).toBe(1);
    expect(firstQueuePage.items.length).toBeLessThanOrEqual(1);
    expect(firstQueuePage.total).toBeGreaterThanOrEqual(1);
    expect((await notificationsFor(submission.id)).map((row) => row.type)).toContain(
      'PAYMENT_PROOF_SUBMITTED'
    );

    const replay = await createPaymentSubmission(
      { ...input, studentId: fixture.studentId, proof: proofInput() },
      fixture.parentUserId,
      db,
      new ConsoleEmailProvider()
    );
    expect(replay.id).toBe(submission.id);
    expect((await listParentPaymentSubmissions(fixture.parentUserId, {}, db)).items).toHaveLength(
      1
    );
    await expect(
      createPaymentSubmission(
        {
          ...input,
          studentId: fixture.studentId,
          amountCentavos: 41_000,
          proof: proofInput(),
        },
        fixture.parentUserId,
        db,
        new ConsoleEmailProvider()
      )
    ).rejects.toThrow('already used for different data');
  });

  it('enforces parent ownership for submission creation, history, and proof retrieval', async () => {
    const linkedFixture = await createFixture();
    const otherFixture = await createFixture();
    const submission = await submit(linkedFixture);

    await expect(
      createPaymentSubmission(
        {
          studentId: otherFixture.studentId,
          paymentChannel: 'GCASH',
          amountCentavos: 10_000,
          referenceNumber: `P2-UNLINKED-${randomUUID()}`,
          paidAt: '2026-08-11T08:30:00+08:00',
          idempotencyKey: `phase-two-unlinked-${randomUUID()}`,
          proof: proofInput(),
        },
        linkedFixture.parentUserId,
        db,
        new ConsoleEmailProvider()
      )
    ).rejects.toThrow('linked children');

    await expect(
      getPaymentProof(submission.id, { id: unrelatedParentUserId, role: 'PARENT' }, db)
    ).rejects.toThrow('own payment proofs');
    await expect(
      getPaymentProof(submission.id, { id: linkedFixture.studentUserId, role: 'STUDENT' }, db)
    ).rejects.toThrow('Only the submitting parent');
    expect(
      (await listParentPaymentSubmissions(otherFixture.parentUserId, {}, db)).items
    ).toHaveLength(0);
  });

  it('rejects unsupported MIME, bad magic bytes, oversized files, unsafe names, and empty normalized references', async () => {
    const fixture = await createFixture();
    const baseInput = {
      studentId: fixture.studentId,
      paymentChannel: 'GCASH' as const,
      amountCentavos: 10_000,
      referenceNumber: `P2-VALIDATION-${randomUUID()}`,
      paidAt: '2026-08-11T08:30:00+08:00',
      idempotencyKey: `phase-two-validation-${randomUUID()}`,
    };
    const attempt = (proof: PaymentProofInput, overrides: Partial<typeof baseInput> = {}) =>
      createPaymentSubmission(
        { ...baseInput, ...overrides, proof },
        fixture.parentUserId,
        db,
        new ConsoleEmailProvider()
      );

    await expect(
      attempt(proofInput({ mimeType: 'application/pdf', originalFileName: 'proof.pdf' }))
    ).rejects.toThrow('JPEG, PNG, or WebP');
    await expect(attempt(proofInput({ data: Buffer.from('not-a-png') }))).rejects.toThrow(
      'does not match'
    );
    await expect(
      attempt(proofInput({ data: Buffer.alloc(MAX_PAYMENT_PROOF_BYTES + 1) }))
    ).rejects.toThrow('between 1 byte and 3 MiB');
    await expect(attempt(proofInput({ originalFileName: 'x'.repeat(161) }))).rejects.toThrow(
      'filename must be between'
    );
    await expect(
      attempt(proofInput(), {
        referenceNumber: '---',
        idempotencyKey: `phase-two-empty-${randomUUID()}`,
      })
    ).rejects.toThrow('at least one letter or number');
    expect(await paymentRows(fixture.studentId)).toHaveLength(0);
  });

  it('approves GCash through PaymentService, creates accounting records, notifies recipients, and supports reversal', async () => {
    const fixture = await createFixture();
    const submission = await submit(fixture, {
      paymentChannel: 'GCASH',
      amountCentavos: 40_000,
      referenceNumber: 'P2-GCASH-APPROVE',
    });
    const approved = await approvePaymentSubmission(
      submission.id,
      financeUserId,
      db,
      new ConsoleEmailProvider()
    );
    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewedByUserId).toBe(financeUserId);
    expect(approved.reviewedAt).toBeTruthy();
    expect(approved.approvedPaymentId).toBeTruthy();
    createdPaymentIds.push(approved.approvedPaymentId!);
    notificationEntityIds.add(approved.approvedPaymentId!);

    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, approved.approvedPaymentId!));
    expect(payment).toMatchObject({
      paymentMethod: 'GCASH',
      status: 'POSTED',
      referenceNumber: 'P2-GCASH-APPROVE',
      processedByUserId: financeUserId,
    });
    const [receipt] = await db
      .select()
      .from(schema.receipts)
      .where(eq(schema.receipts.paymentId, approved.approvedPaymentId!));
    expect(receipt?.status).toBe('ACTIVE');
    if (receipt) {
      createdReceiptIds.push(receipt.id);
      notificationEntityIds.add(receipt.id);
    }
    expect(
      await db
        .select()
        .from(schema.paymentAllocations)
        .where(eq(schema.paymentAllocations.paymentId, approved.approvedPaymentId!))
    ).toHaveLength(1);
    expect(ledgerBalance(await balanceRows(fixture.studentId))).toBe(60_000);
    expect((await notificationsFor(approved.approvedPaymentId!)).map((row) => row.type)).toContain(
      'PAYMENT_SUCCESSFUL'
    );

    await expect(
      approvePaymentSubmission(submission.id, financeUserId, db, new ConsoleEmailProvider())
    ).rejects.toThrow('Only a pending');

    const reversal = await PaymentService.reversePayment(
      {
        paymentId: approved.approvedPaymentId!,
        reason: 'Phase 2 reversal compatibility check',
        reversedByUserId: adminUserId,
      },
      db
    );
    expect(reversal.paymentStatus).toBe('REVERSED');
    expect(ledgerBalance(await balanceRows(fixture.studentId))).toBe(100_000);
    expect((await getPaymentSubmission(submission.id, db)).status).toBe('APPROVED');
  });

  it('approves Maya with the same financial path', async () => {
    const fixture = await createFixture();
    const submission = await submit(fixture, {
      paymentChannel: 'MAYA',
      amountCentavos: 25_000,
      referenceNumber: 'P2-MAYA-APPROVE',
    });
    const approved = await approvePaymentSubmission(
      submission.id,
      financeUserId,
      db,
      new ConsoleEmailProvider()
    );
    expect(approved.status).toBe('APPROVED');
    createdPaymentIds.push(approved.approvedPaymentId!);
    notificationEntityIds.add(approved.approvedPaymentId!);

    const [payment] = await db
      .select({ method: schema.payments.paymentMethod })
      .from(schema.payments)
      .where(eq(schema.payments.id, approved.approvedPaymentId!));
    expect(payment?.method).toBe('MAYA');
    expect(ledgerBalance(await balanceRows(fixture.studentId))).toBe(75_000);
  });

  it('rejects with a required reason and makes no financial writes', async () => {
    const fixture = await createFixture();
    const submission = await submit(fixture, {
      amountCentavos: 30_000,
      referenceNumber: 'P2-REJECT-ME',
    });
    await expect(
      rejectPaymentSubmission(submission.id, financeUserId, { reason: '  ' }, db)
    ).rejects.toThrow();
    const rejected = await rejectPaymentSubmission(
      submission.id,
      financeUserId,
      { reason: 'The uploaded proof is not readable.' },
      db,
      new ConsoleEmailProvider()
    );
    expect(rejected).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'The uploaded proof is not readable.',
      approvedPaymentId: null,
      reviewedByUserId: financeUserId,
    });
    expect(rejected.reviewedAt).toBeTruthy();
    expect(await paymentRows(fixture.studentId)).toHaveLength(0);
    expect(ledgerBalance(await balanceRows(fixture.studentId))).toBe(100_000);
    // Clearing reviewer metadata from a normal rejected submission is rejected by database lifecycle constraint
    await expect(
      db
        .update(schema.paymentSubmissions)
        .set({ reviewedByUserId: null, reviewedAt: null })
        .where(eq(schema.paymentSubmissions.id, submission.id))
    ).rejects.toThrow();

    expect(await getPaymentSubmission(submission.id, db)).toMatchObject({
      status: 'REJECTED',
      reviewedByUserId: financeUserId,
      rejectionReason: 'The uploaded proof is not readable.',
      approvedPaymentId: null,
    });
    expect((await notificationsFor(submission.id)).map((row) => row.type)).toContain(
      'PAYMENT_PROOF_REJECTED'
    );
    await expect(
      rejectPaymentSubmission(
        submission.id,
        financeUserId,
        { reason: 'Second review' },
        db,
        new ConsoleEmailProvider()
      )
    ).rejects.toThrow('Only a pending');
  });

  it('blocks active duplicate references per channel but permits reuse after rejection', async () => {
    const firstFixture = await createFixture();
    const secondFixture = await createFixture();
    const referenceNumber = 'P2-DUPLICATE-001';
    const first = await submit(firstFixture, { referenceNumber });
    await expect(submit(secondFixture, { referenceNumber })).rejects.toThrow(
      'already uses this reference'
    );

    await rejectPaymentSubmission(
      first.id,
      financeUserId,
      { reason: 'Duplicate test cleanup' },
      db,
      new ConsoleEmailProvider()
    );
    const reused = await submit(secondFixture, {
      referenceNumber,
      idempotencyKey: `phase-two-reused-${randomUUID()}`,
    });
    expect(reused.status).toBe('PENDING_VERIFICATION');
  });

  it('rechecks the authoritative balance at approval and leaves an overpayment pending', async () => {
    const fixture = await createFixture();
    const larger = await submit(fixture, {
      amountCentavos: 70_000,
      referenceNumber: 'P2-OVERPAYMENT-FIRST',
    });
    const smaller = await submit(fixture, {
      amountCentavos: 40_000,
      referenceNumber: 'P2-OVERPAYMENT-SECOND',
    });
    const approved = await approvePaymentSubmission(
      larger.id,
      financeUserId,
      db,
      new ConsoleEmailProvider()
    );
    createdPaymentIds.push(approved.approvedPaymentId!);
    notificationEntityIds.add(approved.approvedPaymentId!);
    await expect(
      approvePaymentSubmission(smaller.id, financeUserId, db, new ConsoleEmailProvider())
    ).rejects.toThrow();
    expect((await getPaymentSubmission(smaller.id, db)).status).toBe('PENDING_VERIFICATION');
    expect(await paymentRows(fixture.studentId)).toHaveLength(1);
    expect(ledgerBalance(await balanceRows(fixture.studentId))).toBe(30_000);
  });

  it('serializes concurrent staff approval into one payment and one approved submission', async () => {
    const fixture = await createFixture();
    const submission = await submit(fixture, {
      amountCentavos: 30_000,
      referenceNumber: 'P2-CONCURRENT-APPROVE',
    });
    const results = await Promise.allSettled([
      approvePaymentSubmission(submission.id, financeUserId, db, new ConsoleEmailProvider()),
      approvePaymentSubmission(submission.id, financeUserId, db, new ConsoleEmailProvider()),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const [stored] = await db
      .select()
      .from(schema.paymentSubmissions)
      .where(eq(schema.paymentSubmissions.id, submission.id));
    expect(stored?.status).toBe('APPROVED');
    expect(stored?.approvedPaymentId).toBeTruthy();
    createdPaymentIds.push(stored!.approvedPaymentId!);
    notificationEntityIds.add(stored!.approvedPaymentId!);
    expect(
      await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.idempotencyKey, `payment-submission:${submission.id}`))
    ).toHaveLength(1);
    expect(ledgerBalance(await balanceRows(fixture.studentId))).toBe(70_000);
  });
});
