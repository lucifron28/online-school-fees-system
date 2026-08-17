import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb, type DatabaseInstance } from '../index';
import * as schema from '../schema';
import { calculateBalanceFromEntries } from '../../server/services/assessment.service';
import { getPaymentDestinationOptions } from '../../server/services/payment-submission.service';
import {
  approvePaymentSubmission,
  createPaymentSubmission,
  getPaymentProof,
  getPaymentSubmission,
  listParentPaymentSubmissions,
} from '../../server/services/payment-submission.service';
import { ConsoleEmailProvider } from '../../server/services/notification.service';
import { PaymentService } from '../../server/services/payment.service';

const fictionalPaymentProof = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function findPositiveBalanceStudent(db: DatabaseInstance, parentUserId: string) {
  const candidates = await db
    .select({ studentId: schema.students.id })
    .from(schema.guardians)
    .innerJoin(schema.guardianStudents, eq(schema.guardianStudents.guardianId, schema.guardians.id))
    .innerJoin(schema.students, eq(schema.students.id, schema.guardianStudents.studentId))
    .where(and(eq(schema.guardians.userId, parentUserId), eq(schema.students.status, 'ACTIVE')))
    .orderBy(asc(schema.students.studentNumber));

  for (const candidate of candidates) {
    const entries = await db
      .select({
        debitCentavos: schema.ledgerEntries.debitCentavos,
        creditCentavos: schema.ledgerEntries.creditCentavos,
      })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.studentId, candidate.studentId));
    const balanceCentavos = calculateBalanceFromEntries(entries);
    if (balanceCentavos > 0) return { studentId: candidate.studentId, balanceCentavos };
  }
  return null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for payment proof verification.');
  const db = getDb(databaseUrl);
  const provider = new ConsoleEmailProvider();
  const suffix = randomUUID();
  let submissionId: string | null = null;
  let paymentId: string | null = null;
  let receiptId: string | null = null;
  let studentId: string | null = null;
  let originalBalance = 0;

  try {
    const users = await db
      .select({ id: schema.users.id, email: schema.users.email, role: schema.users.role })
      .from(schema.users)
      .where(inArray(schema.users.email, ['parent@demo.school', 'finance@demo.school']));
    const parent = users.find((user) => user.email === 'parent@demo.school');
    const finance = users.find((user) => user.email === 'finance@demo.school');
    assert(parent?.role === 'PARENT', 'The seeded parent account is required.');
    assert(finance?.role === 'FINANCE_STAFF', 'The seeded finance account is required.');

    const destinations = await getPaymentDestinationOptions(db);
    const channel = destinations.gcash ? 'GCASH' : destinations.maya ? 'MAYA' : null;
    assert(channel, 'At least one configured GCash or Maya destination is required.');
    const fixture = await findPositiveBalanceStudent(db, parent.id);
    assert(fixture, 'A linked demo child with an outstanding balance is required.');
    studentId = fixture.studentId;
    originalBalance = fixture.balanceCentavos;
    const amountCentavos = Math.min(10_000, fixture.balanceCentavos);
    const referenceNumber = `VERIFY-MANUAL-${suffix}`;
    const idempotencyKey = `verify-manual-payment-${suffix}`;

    const created = await createPaymentSubmission(
      {
        studentId: fixture.studentId,
        paymentChannel: channel,
        amountCentavos,
        referenceNumber,
        paidAt: '2026-08-11T08:30:00+08:00',
        idempotencyKey,
        proof: {
          mimeType: 'image/png',
          originalFileName: 'fictional-verification-proof.png',
          data: fictionalPaymentProof,
        },
      },
      parent.id,
      db,
      provider
    );
    submissionId = created.id;
    assert(created.status === 'PENDING_VERIFICATION', 'Submission did not start pending.');
    assert(
      created.currentBalanceCentavos === originalBalance,
      'Pending proof changed the balance.'
    );

    const proof = await getPaymentProof(created.id, { id: parent.id, role: 'PARENT' }, db);
    assert(Buffer.from(proof.data).equals(fictionalPaymentProof), 'Proof bytes were not retained.');
    const parentHistory = await listParentPaymentSubmissions(parent.id, {}, db);
    assert(
      parentHistory.items.some((item) => item.id === created.id),
      'Parent history omitted proof.'
    );

    const approved = await approvePaymentSubmission(created.id, finance.id, db, provider);
    paymentId = approved.approvedPaymentId;
    assert(approved.status === 'APPROVED' && paymentId, 'Proof approval did not post payment.');
    assert(
      approved.reviewedByUserId === finance.id && approved.reviewedAt,
      'Approved proof was not attributed to the finance reviewer.'
    );
    const [payment] = await db
      .select({ method: schema.payments.paymentMethod })
      .from(schema.payments)
      .where(eq(schema.payments.id, paymentId));
    assert(payment?.method === channel, 'Posted payment method did not match the proof channel.');
    const [receipt] = await db
      .select({ id: schema.receipts.id })
      .from(schema.receipts)
      .where(eq(schema.receipts.paymentId, paymentId));
    assert(receipt, 'Approved manual payment did not create a receipt.');
    receiptId = receipt.id;

    const reversed = await PaymentService.reversePayment(
      {
        paymentId,
        reason: 'Manual payment verifier cleanup',
        reversedByUserId: finance.id,
      },
      db
    );
    assert(reversed.paymentStatus === 'REVERSED', 'Manual payment reversal did not complete.');
    const afterReversal = await db
      .select({
        debitCentavos: schema.ledgerEntries.debitCentavos,
        creditCentavos: schema.ledgerEntries.creditCentavos,
      })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.studentId, fixture.studentId));
    assert(
      calculateBalanceFromEntries(afterReversal) === originalBalance,
      'Verifier cleanup reversal did not restore the original balance.'
    );
    assert(
      (await getPaymentSubmission(created.id, db)).status === 'APPROVED',
      'History changed after reversal.'
    );

    console.log(
      `Manual payment proof contract verified for ${channel}: ownership, proof persistence, pending balance isolation, finance approval, receipt creation, ledger posting, and reversal compatibility.`
    );
  } finally {
    const entityIds = [submissionId, paymentId, receiptId].filter(Boolean) as string[];
    if (entityIds.length > 0) {
      const notificationIds = await db
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(inArray(schema.notifications.entityId, entityIds));
      if (notificationIds.length > 0) {
        await db.delete(schema.notifications).where(
          inArray(
            schema.notifications.id,
            notificationIds.map((row) => row.id)
          )
        );
      }
      await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.entityId, entityIds));
    }
    if (submissionId) {
      await db
        .delete(schema.paymentSubmissionProofs)
        .where(eq(schema.paymentSubmissionProofs.submissionId, submissionId));
      await db
        .delete(schema.paymentSubmissions)
        .where(eq(schema.paymentSubmissions.id, submissionId));
    }
    if (paymentId) {
      await db
        .delete(schema.paymentReversals)
        .where(eq(schema.paymentReversals.paymentId, paymentId));
      await db
        .delete(schema.paymentAllocations)
        .where(eq(schema.paymentAllocations.paymentId, paymentId));
      await db.delete(schema.receipts).where(eq(schema.receipts.paymentId, paymentId));
      await db.delete(schema.payments).where(eq(schema.payments.id, paymentId));
      if (studentId) {
        await db
          .delete(schema.ledgerEntries)
          .where(
            and(
              eq(schema.ledgerEntries.studentId, studentId),
              inArray(schema.ledgerEntries.description, [
                `Payment ${paymentId}`,
                `Reversal for payment ${paymentId}`,
              ])
            )
          );
      }
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
