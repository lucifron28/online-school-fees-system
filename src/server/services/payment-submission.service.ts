import { createHash } from 'node:crypto';
import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import {
  normalizePaymentReference,
  paymentSubmissionCreateInputSchema,
  paymentSubmissionListInputSchema,
  paymentSubmissionRejectInputSchema,
  type PaymentSubmissionCreateInput,
  type PaymentSubmissionListInput,
} from '@/lib/payment-submissions';
import { calculateBalanceFromEntries } from './assessment.service';
import { getOrCreateSchoolSettings } from './administration.service';
import { lockStudentForLedgerMutation } from './ledger.service';
import { getEmailProvider, NotificationService, type EmailProvider } from './notification.service';
import { PaymentService } from './payment.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errors';

export const MAX_PAYMENT_PROOF_BYTES = 3 * 1024 * 1024;
export const MAX_PAYMENT_PROOF_REQUEST_BYTES = MAX_PAYMENT_PROOF_BYTES + 256 * 1024;

const allowedProofMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface PaymentProofInput {
  mimeType: string;
  originalFileName: string;
  data: Buffer;
}

export interface PaymentSubmissionListItem {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  studentStatus: string;
  submittedByUserId: string;
  submittedByName: string;
  submittedByEmail: string;
  paymentChannel: 'GCASH' | 'MAYA';
  amountCentavos: number;
  referenceNumber: string;
  paidAt: Date;
  status: 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED';
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  approvedPaymentId: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
  proofId: string | null;
  proofMimeType: string | null;
  proofSizeBytes: number | null;
  currentBalanceCentavos: number;
  paymentDestination: { accountName: string; accountNumber: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentDestinationOptions {
  gcash: { accountName: string; accountNumber: string } | null;
  maya: { accountName: string; accountNumber: string } | null;
}

type ViewerRole = 'ADMIN' | 'FINANCE_STAFF' | 'PARENT' | 'STUDENT';

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function assertSubmissionIdempotencyCompatible(
  existing: typeof schema.paymentSubmissions.$inferSelect,
  values: PaymentSubmissionCreateInput,
  normalizedReferenceNumber: string,
  paidAt: Date,
  submittedByUserId: string
) {
  const sameRequest =
    existing.submittedByUserId === submittedByUserId &&
    existing.studentId === values.studentId &&
    existing.paymentChannel === values.paymentChannel &&
    existing.amountCentavos === values.amountCentavos &&
    existing.normalizedReferenceNumber === normalizedReferenceNumber &&
    existing.paidAt.getTime() === paidAt.getTime();
  if (!sameRequest) {
    throw new ConflictError('The submission idempotency key was already used for different data.');
  }
}

function sanitizeFileName(fileName: string) {
  const sanitized = fileName
    .replace(/[\\/]/g, '_')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .trim();
  if (sanitized.length < 1 || sanitized.length > 160) {
    throw new ValidationError('The proof filename must be between 1 and 160 characters.');
  }
  return sanitized;
}

function hasProofSignature(mimeType: string, data: Buffer) {
  if (mimeType === 'image/jpeg') {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      data.length >= 8 &&
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).equals(data.subarray(0, 8))
    );
  }
  return (
    mimeType === 'image/webp' &&
    data.length >= 12 &&
    data.subarray(0, 4).toString('ascii') === 'RIFF' &&
    data.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

export function validateProof(proof: PaymentProofInput) {
  if (!allowedProofMimeTypes.has(proof.mimeType)) {
    throw new ValidationError('Proof must be a JPEG, PNG, or WebP image.');
  }
  if (proof.data.length < 1 || proof.data.length > MAX_PAYMENT_PROOF_BYTES) {
    throw new ValidationError('Proof images must be between 1 byte and 3 MiB.');
  }
  if (!hasProofSignature(proof.mimeType, proof.data)) {
    throw new ValidationError('The proof content does not match its declared image type.');
  }

  return {
    mimeType: proof.mimeType,
    originalFileName: sanitizeFileName(proof.originalFileName),
    sizeBytes: proof.data.length,
    sha256: createHash('sha256').update(proof.data).digest('hex'),
    data: proof.data,
  };
}

export function assertPaymentProofRequestSize(request: Request) {
  const contentLength = request.headers.get('content-length');
  if (!contentLength) return;
  const parsedLength = Number(contentLength);
  if (
    !Number.isFinite(parsedLength) ||
    parsedLength > MAX_PAYMENT_PROOF_REQUEST_BYTES ||
    parsedLength < 1
  ) {
    throw new ValidationError('The payment proof upload is too large or invalid.');
  }
}

export function createBoundedStream(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number = MAX_PAYMENT_PROOF_REQUEST_BYTES
): ReadableStream<Uint8Array> {
  let totalBytes = 0;
  return new ReadableStream({
    async start(controller) {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            controller.error(new ValidationError('The payment proof upload is too large.'));
            break;
          }
          controller.enqueue(value);
        }
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

export async function readBoundedMultipartRequest(request: Request): Promise<FormData> {
  assertPaymentProofRequestSize(request);

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data') || !request.body) {
    return request.formData();
  }

  const boundedStream = createBoundedStream(request.body, MAX_PAYMENT_PROOF_REQUEST_BYTES);
  const boundedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: boundedStream,
    // @ts-expect-error Node duplex option
    duplex: 'half',
  });

  return boundedRequest.formData();
}
function parsePaidAt(value: string) {
  const paidAt = new Date(value);
  if (!Number.isFinite(paidAt.getTime())) throw new ValidationError('Payment date is invalid.');
  return paidAt;
}

async function assertParentOwnsStudent(
  parentUserId: string,
  studentId: string,
  db: DatabaseInstance
) {
  const rows = await db
    .select({ id: schema.guardianStudents.id })
    .from(schema.guardians)
    .innerJoin(schema.guardianStudents, eq(schema.guardianStudents.guardianId, schema.guardians.id))
    .where(
      and(
        eq(schema.guardians.userId, parentUserId),
        eq(schema.guardianStudents.studentId, studentId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new ForbiddenError('Parents may only submit proof for linked children.');
}

async function assertParentOwnsSubmission(
  parentUserId: string,
  submissionId: string,
  db: DatabaseInstance
) {
  const rows = await db
    .select({ id: schema.paymentSubmissions.id })
    .from(schema.paymentSubmissions)
    .innerJoin(
      schema.guardianStudents,
      eq(schema.guardianStudents.studentId, schema.paymentSubmissions.studentId)
    )
    .innerJoin(schema.guardians, eq(schema.guardians.id, schema.guardianStudents.guardianId))
    .where(
      and(
        eq(schema.paymentSubmissions.id, submissionId),
        eq(schema.paymentSubmissions.submittedByUserId, parentUserId),
        eq(schema.guardians.userId, parentUserId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new ForbiddenError('Parents may only access their own payment proofs.');
}

async function selectBalances(studentIds: string[], db: DatabaseInstance) {
  const balances = new Map<string, number>();
  if (studentIds.length === 0) return balances;
  const rows = await db
    .select({
      studentId: schema.ledgerEntries.studentId,
      debitCentavos: schema.ledgerEntries.debitCentavos,
      creditCentavos: schema.ledgerEntries.creditCentavos,
    })
    .from(schema.ledgerEntries)
    .where(inArray(schema.ledgerEntries.studentId, studentIds));
  const entriesByStudent = new Map<
    string,
    Array<{ debitCentavos: number; creditCentavos: number }>
  >();
  for (const row of rows) {
    const entries = entriesByStudent.get(row.studentId) ?? [];
    entries.push(row);
    entriesByStudent.set(row.studentId, entries);
  }
  for (const studentId of studentIds) {
    balances.set(studentId, calculateBalanceFromEntries(entriesByStudent.get(studentId) ?? []));
  }
  return balances;
}

function submissionSelection() {
  return {
    id: schema.paymentSubmissions.id,
    studentId: schema.paymentSubmissions.studentId,
    studentNumber: schema.students.studentNumber,
    studentFirstName: schema.students.firstName,
    studentLastName: schema.students.lastName,
    studentStatus: schema.students.status,
    submittedByUserId: schema.paymentSubmissions.submittedByUserId,
    submittedByName: schema.users.name,
    submittedByEmail: schema.users.email,
    paymentChannel: schema.paymentSubmissions.paymentChannel,
    amountCentavos: schema.paymentSubmissions.amountCentavos,
    referenceNumber: schema.paymentSubmissions.referenceNumber,
    destinationAccountName: schema.paymentSubmissions.destinationAccountName,
    destinationAccountNumber: schema.paymentSubmissions.destinationAccountNumber,
    paidAt: schema.paymentSubmissions.paidAt,
    status: schema.paymentSubmissions.status,
    reviewedByUserId: schema.paymentSubmissions.reviewedByUserId,
    reviewedAt: schema.paymentSubmissions.reviewedAt,
    rejectionReason: schema.paymentSubmissions.rejectionReason,
    approvedPaymentId: schema.paymentSubmissions.approvedPaymentId,
    receiptId: schema.receipts.id,
    receiptNumber: schema.receipts.receiptNumber,
    proofId: schema.paymentSubmissionProofs.id,
    proofMimeType: schema.paymentSubmissionProofs.mimeType,
    proofSizeBytes: schema.paymentSubmissionProofs.sizeBytes,
    createdAt: schema.paymentSubmissions.createdAt,
    updatedAt: schema.paymentSubmissions.updatedAt,
  };
}

type SelectedSubmission = {
  id: string;
  studentId: string;
  studentNumber: string;
  studentFirstName: string;
  studentLastName: string;
  studentStatus: 'ACTIVE' | 'INACTIVE' | 'WITHDRAWN' | 'GRADUATED';
  submittedByUserId: string;
  submittedByName: string;
  submittedByEmail: string;
  paymentChannel: 'GCASH' | 'MAYA';
  amountCentavos: number;
  referenceNumber: string;
  destinationAccountName: string | null;
  destinationAccountNumber: string | null;
  paidAt: Date;
  status: 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED';
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  approvedPaymentId: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
  proofId: string | null;
  proofMimeType: string | null;
  proofSizeBytes: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function toSubmissionItem(
  row: SelectedSubmission,
  balances: Map<string, number>
): PaymentSubmissionListItem {
  return {
    id: row.id,
    studentId: row.studentId,
    studentNumber: row.studentNumber,
    studentName: `${row.studentFirstName} ${row.studentLastName}`,
    studentStatus: row.studentStatus,
    submittedByUserId: row.submittedByUserId,
    submittedByName: row.submittedByName,
    submittedByEmail: row.submittedByEmail,
    paymentChannel: row.paymentChannel,
    amountCentavos: row.amountCentavos,
    referenceNumber: row.referenceNumber,
    paymentDestination:
      row.destinationAccountName && row.destinationAccountNumber
        ? {
            accountName: row.destinationAccountName,
            accountNumber: row.destinationAccountNumber,
          }
        : null,
    paidAt: row.paidAt,
    status: row.status,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
    rejectionReason: row.rejectionReason,
    approvedPaymentId: row.approvedPaymentId,
    receiptId: row.receiptId,
    receiptNumber: row.receiptNumber,
    proofId: row.proofId,
    proofMimeType: row.proofMimeType,
    proofSizeBytes: row.proofSizeBytes,
    currentBalanceCentavos: balances.get(row.studentId) ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function buildListConditions(input: PaymentSubmissionListInput) {
  const conditions: SQL[] = [];
  if (input.status) conditions.push(eq(schema.paymentSubmissions.status, input.status));
  if (input.paymentChannel) {
    conditions.push(eq(schema.paymentSubmissions.paymentChannel, input.paymentChannel));
  }
  if (input.search) {
    const pattern = `%${escapeLike(input.search)}%`;
    conditions.push(
      or(
        ilike(schema.students.studentNumber, pattern),
        ilike(schema.students.firstName, pattern),
        ilike(schema.students.lastName, pattern),
        ilike(schema.paymentSubmissions.referenceNumber, pattern),
        ilike(schema.users.email, pattern)
      )!
    );
  }
  return conditions;
}

async function listInternal(
  input: PaymentSubmissionListInput,
  db: DatabaseInstance,
  extraConditions: SQL[] = []
) {
  const conditions = [...extraConditions, ...buildListConditions(input)];
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (input.page - 1) * input.pageSize;
  const selection = submissionSelection();
  const [rows, totalRows] = await Promise.all([
    db
      .select(selection)
      .from(schema.paymentSubmissions)
      .innerJoin(schema.students, eq(schema.students.id, schema.paymentSubmissions.studentId))
      .innerJoin(schema.users, eq(schema.users.id, schema.paymentSubmissions.submittedByUserId))
      .leftJoin(
        schema.paymentSubmissionProofs,
        eq(schema.paymentSubmissionProofs.submissionId, schema.paymentSubmissions.id)
      )
      .leftJoin(
        schema.payments,
        eq(schema.payments.id, schema.paymentSubmissions.approvedPaymentId)
      )
      .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
      .where(where)
      .orderBy(desc(schema.paymentSubmissions.createdAt), asc(schema.paymentSubmissions.id))
      .limit(input.pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(schema.paymentSubmissions)
      .innerJoin(schema.students, eq(schema.students.id, schema.paymentSubmissions.studentId))
      .innerJoin(schema.users, eq(schema.users.id, schema.paymentSubmissions.submittedByUserId))
      .where(where),
  ]);
  const balances = await selectBalances([...new Set(rows.map((row) => row.studentId))], db);
  const total = Number(totalRows[0]?.total ?? 0);
  return {
    items: rows.map((row) => toSubmissionItem(row as SelectedSubmission, balances)),
    page: input.page,
    pageSize: input.pageSize,
    total,
    pageCount: Math.ceil(total / input.pageSize),
  };
}

export async function getPaymentDestinationOptions(
  db: DatabaseInstance = getDb()
): Promise<PaymentDestinationOptions> {
  const settings = await getOrCreateSchoolSettings(db);
  return {
    gcash:
      settings.gcashEnabled && settings.gcashAccountName && settings.gcashAccountNumber
        ? { accountName: settings.gcashAccountName, accountNumber: settings.gcashAccountNumber }
        : null,
    maya:
      settings.mayaEnabled && settings.mayaAccountName && settings.mayaAccountNumber
        ? { accountName: settings.mayaAccountName, accountNumber: settings.mayaAccountNumber }
        : null,
  };
}

export async function createPaymentSubmission(
  input: PaymentSubmissionCreateInput & { proof: PaymentProofInput },
  submittedByUserId: string,
  db: DatabaseInstance = getDb(),
  provider: EmailProvider = getEmailProvider()
) {
  const values = paymentSubmissionCreateInputSchema.parse(input);
  const normalizedReferenceNumber = normalizePaymentReference(values.referenceNumber);
  if (normalizedReferenceNumber.length === 0) {
    throw new ValidationError('Reference number must contain at least one letter or number.');
  }
  const paidAt = parsePaidAt(values.paidAt);
  const proof = validateProof(input.proof);
  await assertParentOwnsStudent(submittedByUserId, values.studentId, db);

  const existing = await db
    .select()
    .from(schema.paymentSubmissions)
    .where(eq(schema.paymentSubmissions.idempotencyKey, values.idempotencyKey))
    .limit(1);
  if (existing[0]) {
    assertSubmissionIdempotencyCompatible(
      existing[0],
      values,
      normalizedReferenceNumber,
      paidAt,
      submittedByUserId
    );
    return getPaymentSubmission(existing[0].id, db);
  }

  try {
    const created = await db.transaction(async (tx) => {
      const transactionDb = tx as unknown as DatabaseInstance;
      const settings = await getOrCreateSchoolSettings(transactionDb);
      const destination =
        values.paymentChannel === 'GCASH'
          ? settings.gcashEnabled && settings.gcashAccountName && settings.gcashAccountNumber
            ? {
                accountName: settings.gcashAccountName,
                accountNumber: settings.gcashAccountNumber,
              }
            : null
          : settings.mayaEnabled && settings.mayaAccountName && settings.mayaAccountNumber
            ? { accountName: settings.mayaAccountName, accountNumber: settings.mayaAccountNumber }
            : null;
      if (!destination) {
        throw new ValidationError(`${values.paymentChannel} proof submissions are not enabled.`);
      }
      const [submission] = await tx
        .insert(schema.paymentSubmissions)
        .values({
          studentId: values.studentId,
          submittedByUserId,
          paymentChannel: values.paymentChannel,
          amountCentavos: values.amountCentavos,
          referenceNumber: values.referenceNumber,
          normalizedReferenceNumber,
          destinationAccountName: destination.accountName,
          destinationAccountNumber: destination.accountNumber,
          paidAt,
          idempotencyKey: values.idempotencyKey,
        })
        .returning();
      if (!submission)
        throw new ValidationError('The payment proof submission could not be created.');

      await tx.insert(schema.paymentSubmissionProofs).values({
        submissionId: submission.id,
        mimeType: proof.mimeType,
        originalFileName: proof.originalFileName,
        sizeBytes: proof.sizeBytes,
        sha256: proof.sha256,
        data: proof.data,
      });
      await tx.insert(schema.auditLogs).values({
        userId: submittedByUserId,
        action: 'PAYMENT_PROOF_SUBMITTED',
        entityType: 'PAYMENT_SUBMISSION',
        entityId: submission.id,
        details: JSON.stringify({
          studentId: values.studentId,
          paymentChannel: values.paymentChannel,
          amountCentavos: values.amountCentavos,
          referenceNumber: values.referenceNumber,
          paidAt: paidAt.toISOString(),
          proofMimeType: proof.mimeType,
          proofSizeBytes: proof.sizeBytes,
          proofSha256: proof.sha256,
        }),
      });
      return submission;
    });
    await NotificationService.notifyPaymentProofSubmitted(created.id, db, provider);
    return getPaymentSubmission(created.id, db);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const replay = await db
        .select()
        .from(schema.paymentSubmissions)
        .where(eq(schema.paymentSubmissions.idempotencyKey, values.idempotencyKey))
        .limit(1);
      if (replay[0]) {
        assertSubmissionIdempotencyCompatible(
          replay[0],
          values,
          normalizedReferenceNumber,
          paidAt,
          submittedByUserId
        );
        return getPaymentSubmission(replay[0].id, db);
      }
      throw new ConflictError('A pending or approved submission already uses this reference.');
    }
    throw error;
  }
}

export async function listParentPaymentSubmissions(
  userId: string,
  input: Partial<PaymentSubmissionListInput> = {},
  db: DatabaseInstance = getDb()
) {
  const values = paymentSubmissionListInputSchema.parse(input);
  return listInternal(values, db, [eq(schema.paymentSubmissions.submittedByUserId, userId)]);
}

export async function listPaymentSubmissions(
  input: Partial<PaymentSubmissionListInput> = {},
  db: DatabaseInstance = getDb()
) {
  const values = paymentSubmissionListInputSchema.parse(input);
  return listInternal(values, db);
}

export async function getPaymentSubmission(submissionId: string, db: DatabaseInstance = getDb()) {
  const values = await listInternal({ page: 1, pageSize: 1 }, db, [
    eq(schema.paymentSubmissions.id, submissionId),
  ]);
  if (!values.items[0]) throw new NotFoundError('The payment proof submission does not exist.');
  return values.items[0];
}

export async function getPaymentProof(
  submissionId: string,
  viewer: { id: string; role: ViewerRole },
  db: DatabaseInstance = getDb()
) {
  const rows = await db
    .select({
      submissionId: schema.paymentSubmissions.id,
      submittedByUserId: schema.paymentSubmissions.submittedByUserId,
      studentId: schema.paymentSubmissions.studentId,
      mimeType: schema.paymentSubmissionProofs.mimeType,
      originalFileName: schema.paymentSubmissionProofs.originalFileName,
      data: schema.paymentSubmissionProofs.data,
    })
    .from(schema.paymentSubmissions)
    .innerJoin(
      schema.paymentSubmissionProofs,
      eq(schema.paymentSubmissionProofs.submissionId, schema.paymentSubmissions.id)
    )
    .where(eq(schema.paymentSubmissions.id, submissionId))
    .limit(1);
  const proof = rows[0];
  if (!proof) throw new NotFoundError('The payment proof does not exist.');
  if (viewer.role === 'PARENT') {
    await assertParentOwnsSubmission(viewer.id, submissionId, db);
  } else if (viewer.role !== 'ADMIN' && viewer.role !== 'FINANCE_STAFF') {
    throw new ForbiddenError('Only the submitting parent or finance staff may view payment proof.');
  }
  return proof;
}

export async function approvePaymentSubmission(
  submissionId: string,
  reviewerUserId: string,
  db: DatabaseInstance = getDb(),
  provider: EmailProvider = getEmailProvider()
) {
  let paymentId = '';
  try {
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(schema.paymentSubmissions)
        .where(eq(schema.paymentSubmissions.id, submissionId))
        .for('update')
        .limit(1);
      const submission = rows[0];
      if (!submission) throw new NotFoundError('The payment proof submission does not exist.');
      if (submission.status !== 'PENDING_VERIFICATION') {
        throw new ConflictError('Only a pending payment proof can be approved.');
      }

      await lockStudentForLedgerMutation(submission.studentId, tx);
      const payment = await PaymentService.recordPayment(
        {
          studentId: submission.studentId,
          amountCentavos: submission.amountCentavos,
          paymentMethod: submission.paymentChannel,
          referenceNumber: submission.referenceNumber,
          idempotencyKey: `payment-submission:${submission.id}`,
          processedByUserId: reviewerUserId,
          skipNotifications: true,
          notificationProvider: provider,
        },
        tx
      );
      paymentId = payment.id;

      const [updated] = await tx
        .update(schema.paymentSubmissions)
        .set({
          status: 'APPROVED',
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
          approvedPaymentId: payment.id,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.paymentSubmissions.id, submission.id),
            eq(schema.paymentSubmissions.status, 'PENDING_VERIFICATION')
          )
        )
        .returning({ id: schema.paymentSubmissions.id });
      if (!updated) throw new ConflictError('The payment proof was reviewed concurrently.');

      await tx.insert(schema.auditLogs).values({
        userId: reviewerUserId,
        action: 'PAYMENT_PROOF_APPROVED',
        entityType: 'PAYMENT_SUBMISSION',
        entityId: submission.id,
        details: JSON.stringify({
          submissionId: submission.id,
          staffUserId: reviewerUserId,
          paymentId: payment.id,
          decision: 'APPROVED',
        }),
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('This payment proof or reference has already been approved.');
    }
    throw error;
  }

  await NotificationService.notifyPaymentSuccessful(paymentId, db, provider);
  return getPaymentSubmission(submissionId, db);
}

export async function rejectPaymentSubmission(
  submissionId: string,
  reviewerUserId: string,
  input: unknown,
  db: DatabaseInstance = getDb(),
  provider: EmailProvider = getEmailProvider()
) {
  const { reason } = paymentSubmissionRejectInputSchema.parse(input);
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(schema.paymentSubmissions)
      .where(eq(schema.paymentSubmissions.id, submissionId))
      .for('update')
      .limit(1);
    const submission = rows[0];
    if (!submission) throw new NotFoundError('The payment proof submission does not exist.');
    if (submission.status !== 'PENDING_VERIFICATION') {
      throw new ConflictError('Only a pending payment proof can be rejected.');
    }

    const [updated] = await tx
      .update(schema.paymentSubmissions)
      .set({
        status: 'REJECTED',
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.paymentSubmissions.id, submission.id),
          eq(schema.paymentSubmissions.status, 'PENDING_VERIFICATION')
        )
      )
      .returning({ id: schema.paymentSubmissions.id });
    if (!updated) throw new ConflictError('The payment proof was reviewed concurrently.');

    await tx.insert(schema.auditLogs).values({
      userId: reviewerUserId,
      action: 'PAYMENT_PROOF_REJECTED',
      entityType: 'PAYMENT_SUBMISSION',
      entityId: submission.id,
      details: JSON.stringify({
        submissionId: submission.id,
        staffUserId: reviewerUserId,
        decision: 'REJECTED',
        reason,
      }),
    });
  });
  await NotificationService.notifyPaymentProofRejected(submissionId, db, provider);
  return getPaymentSubmission(submissionId, db);
}
