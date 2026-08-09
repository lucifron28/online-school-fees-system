import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import {
  paymentListInputSchema,
  paymentPostInputSchema,
  reversalPostInputSchema,
  type PaymentListInput,
  type PaymentPostInput,
  type ReversalPostInput,
} from '@/lib/payments';
import { addCentavos, formatCentavos, subtractCentavos } from '@/lib/utils/currency';
import { AppError, NotFoundError, ValidationError } from '@/server/errors';
import { calculateBalanceFromEntries } from './assessment.service';
import { lockStudentForLedgerMutation } from './ledger.service';
import { NotificationService, type EmailProvider } from './notification.service';
import { allocateReceiptNumber } from './receipt.service';

export interface OtcPaymentInput extends PaymentPostInput {
  processedByUserId: string;
  notificationProvider?: EmailProvider;
}

export interface OnlinePaymentInput extends PaymentPostInput {
  processedByUserId?: string | null;
  skipNotifications?: boolean;
  notificationProvider?: EmailProvider;
}

export interface ReversalInput extends ReversalPostInput {
  reversedByUserId: string;
}

type AllocationItem = {
  id: string;
  name: string;
  amountCentavos: number;
  paidCentavos: number;
};

type OutstandingItem = AllocationItem & {
  assessmentId: string;
};

/**
 * Sequential allocation algorithm: oldest assessment item first, then the
 * next item in persisted order. The caller must supply database-derived items.
 */
export function allocatePaymentToItems(paymentAmountCentavos: number, items: AllocationItem[]) {
  let remainingPayment = paymentAmountCentavos;
  const allocations: Array<{
    assessmentItemId: string;
    name: string;
    amountCentavos: number;
  }> = [];

  for (const item of items) {
    if (remainingPayment <= 0) break;

    const unpaidAmount = subtractCentavos(item.amountCentavos, item.paidCentavos);
    if (unpaidAmount <= 0) continue;

    const allocated = Math.min(remainingPayment, unpaidAmount);
    allocations.push({
      assessmentItemId: item.id,
      name: item.name,
      amountCentavos: allocated,
    });
    remainingPayment = subtractCentavos(remainingPayment, allocated);
  }

  return allocations;
}

async function insertAuditLog(
  db: DatabaseInstance,
  input: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    details: Record<string, unknown>;
  }
) {
  await db.insert(schema.auditLogs).values({
    userId: input.userId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: JSON.stringify(input.details),
  });
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

async function findPaymentByIdempotencyKey(idempotencyKey: string, db: DatabaseInstance) {
  return db
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(eq(schema.payments.idempotencyKey, idempotencyKey))
    .limit(1);
}

async function selectOutstandingItems(studentId: string, db: DatabaseInstance) {
  const items = await db
    .select({
      assessmentId: schema.studentAssessments.id,
      assessmentItemId: schema.assessmentItems.id,
      name: schema.assessmentItems.name,
      amountCentavos: schema.assessmentItems.amountCentavos,
      assessmentCreatedAt: schema.studentAssessments.createdAt,
      itemCreatedAt: schema.assessmentItems.createdAt,
    })
    .from(schema.studentAssessments)
    .innerJoin(
      schema.assessmentItems,
      eq(schema.assessmentItems.assessmentId, schema.studentAssessments.id)
    )
    .where(
      and(
        eq(schema.studentAssessments.studentId, studentId),
        eq(schema.studentAssessments.status, 'POSTED')
      )
    )
    .orderBy(asc(schema.studentAssessments.createdAt), asc(schema.assessmentItems.createdAt));

  if (items.length === 0) {
    throw new ValidationError('The student has no posted assessment items available for payment.');
  }

  const itemIds = items.map((item) => item.assessmentItemId);
  const allocations = await db
    .select({
      assessmentItemId: schema.paymentAllocations.assessmentItemId,
      amountCentavos: schema.paymentAllocations.amountCentavos,
    })
    .from(schema.paymentAllocations)
    .innerJoin(schema.payments, eq(schema.payments.id, schema.paymentAllocations.paymentId))
    .where(
      and(
        inArray(schema.paymentAllocations.assessmentItemId, itemIds),
        eq(schema.payments.status, 'POSTED')
      )
    );
  const paidByItem = new Map<string, number>();
  for (const allocation of allocations) {
    paidByItem.set(
      allocation.assessmentItemId,
      addCentavos(paidByItem.get(allocation.assessmentItemId) ?? 0, allocation.amountCentavos)
    );
  }

  return items.map<OutstandingItem>((item) => ({
    id: item.assessmentItemId,
    assessmentId: item.assessmentId,
    name: item.name,
    amountCentavos: item.amountCentavos,
    paidCentavos: paidByItem.get(item.assessmentItemId) ?? 0,
  }));
}

async function selectStudentLedger(studentId: string, db: DatabaseInstance) {
  const entries = await db
    .select({
      debitCentavos: schema.ledgerEntries.debitCentavos,
      creditCentavos: schema.ledgerEntries.creditCentavos,
    })
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.studentId, studentId));
  return {
    entries,
    balanceCentavos: calculateBalanceFromEntries(entries),
  };
}

async function selectPaymentRow(id: string, db: DatabaseInstance) {
  const rows = await db
    .select({
      id: schema.payments.id,
      studentId: schema.payments.studentId,
      assessmentId: schema.payments.assessmentId,
      amountCentavos: schema.payments.amountCentavos,
      paymentMethod: schema.payments.paymentMethod,
      referenceNumber: schema.payments.referenceNumber,
      status: schema.payments.status,
      processedByUserId: schema.payments.processedByUserId,
      createdAt: schema.payments.createdAt,
      updatedAt: schema.payments.updatedAt,
      studentNumber: schema.students.studentNumber,
      studentFirstName: schema.students.firstName,
      studentLastName: schema.students.lastName,
      studentEmail: schema.students.email,
      gradeLevelName: schema.gradeLevels.name,
      sectionName: schema.sections.name,
      processedByName: schema.users.name,
      receiptId: schema.receipts.id,
      receiptNumber: schema.receipts.receiptNumber,
      verificationIdentifier: schema.receipts.verificationIdentifier,
      receiptStatus: schema.receipts.status,
      receiptCreatedAt: schema.receipts.createdAt,
    })
    .from(schema.payments)
    .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
    .leftJoin(schema.gradeLevels, eq(schema.gradeLevels.id, schema.students.gradeLevelId))
    .leftJoin(schema.sections, eq(schema.sections.id, schema.students.sectionId))
    .leftJoin(schema.users, eq(schema.users.id, schema.payments.processedByUserId))
    .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
    .where(eq(schema.payments.id, id))
    .limit(1);
  if (!rows[0]) throw new NotFoundError('The payment does not exist.');
  return rows[0];
}

export async function getPayment(id: string, db: DatabaseInstance = getDb()) {
  const payment = await selectPaymentRow(id, db);
  const [allocations, ledger] = await Promise.all([
    db
      .select({
        id: schema.paymentAllocations.id,
        paymentId: schema.paymentAllocations.paymentId,
        assessmentItemId: schema.paymentAllocations.assessmentItemId,
        amountCentavos: schema.paymentAllocations.amountCentavos,
        assessmentId: schema.assessmentItems.assessmentId,
        itemName: schema.assessmentItems.name,
        feeCategoryName: schema.feeCategories.name,
      })
      .from(schema.paymentAllocations)
      .innerJoin(
        schema.assessmentItems,
        eq(schema.assessmentItems.id, schema.paymentAllocations.assessmentItemId)
      )
      .innerJoin(
        schema.feeCategories,
        eq(schema.feeCategories.id, schema.assessmentItems.feeCategoryId)
      )
      .where(eq(schema.paymentAllocations.paymentId, id))
      .orderBy(asc(schema.paymentAllocations.createdAt)),
    selectStudentLedger(payment.studentId, db),
  ]);

  return {
    ...payment,
    receipt: payment.receiptId
      ? {
          id: payment.receiptId,
          receiptNumber: payment.receiptNumber,
          verificationIdentifier: payment.verificationIdentifier,
          status: payment.receiptStatus,
          createdAt: payment.receiptCreatedAt,
        }
      : null,
    allocations,
    remainingBalanceCentavos: ledger.balanceCentavos,
  };
}

export async function listPayments(
  input: Partial<PaymentListInput> = {},
  db: DatabaseInstance = getDb()
) {
  const values = paymentListInputSchema.parse(input);
  const conditions: SQL[] = [];
  if (values.status) conditions.push(eq(schema.payments.status, values.status));
  if (values.search) {
    const pattern = `%${values.search}%`;
    conditions.push(
      or(
        ilike(schema.students.studentNumber, pattern),
        ilike(schema.students.firstName, pattern),
        ilike(schema.students.lastName, pattern),
        ilike(schema.receipts.receiptNumber, pattern),
        ilike(schema.payments.referenceNumber, pattern)
      ) as SQL
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (values.page - 1) * values.pageSize;
  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: schema.payments.id,
        studentId: schema.payments.studentId,
        amountCentavos: schema.payments.amountCentavos,
        paymentMethod: schema.payments.paymentMethod,
        referenceNumber: schema.payments.referenceNumber,
        status: schema.payments.status,
        createdAt: schema.payments.createdAt,
        studentNumber: schema.students.studentNumber,
        studentFirstName: schema.students.firstName,
        studentLastName: schema.students.lastName,
        receiptId: schema.receipts.id,
        receiptNumber: schema.receipts.receiptNumber,
        receiptStatus: schema.receipts.status,
      })
      .from(schema.payments)
      .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
      .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
      .where(where)
      .orderBy(desc(schema.payments.createdAt))
      .limit(values.pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(schema.payments)
      .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
      .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
      .where(where),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);
  return {
    items,
    page: values.page,
    pageSize: values.pageSize,
    total,
    pageCount: Math.ceil(total / values.pageSize),
  };
}

export async function getReceiptPdfData(receiptIdentifier: string, db: DatabaseInstance = getDb()) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    receiptIdentifier
  );
  const receipts = await db
    .select({ id: schema.receipts.id, paymentId: schema.receipts.paymentId })
    .from(schema.receipts)
    .where(
      isUuid
        ? eq(schema.receipts.id, receiptIdentifier)
        : eq(schema.receipts.receiptNumber, receiptIdentifier)
    )
    .limit(1);
  if (!receipts[0]) throw new NotFoundError('The receipt does not exist.');

  const [payment, settings] = await Promise.all([
    getPayment(receipts[0].paymentId, db),
    db.select().from(schema.schoolSettings).limit(1),
  ]);
  if (!payment.receipt || payment.receipt.id !== receipts[0].id) {
    throw new AppError('The payment receipt relationship is invalid.');
  }
  const receipt = payment.receipt;
  const institution = settings[0];
  const timezone = institution?.timezone ?? 'Asia/Manila';
  const paymentDate = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(payment.createdAt);

  return {
    receiptNumber: receipt.receiptNumber ?? '',
    verificationIdentifier: receipt.verificationIdentifier ?? '',
    status: receipt.status ?? 'ACTIVE',
    paymentDate,
    paymentMethod: payment.paymentMethod,
    referenceNumber: payment.referenceNumber ?? undefined,
    studentNumber: payment.studentNumber,
    studentName: `${payment.studentFirstName} ${payment.studentLastName}`,
    gradeAndSection:
      [payment.gradeLevelName, payment.sectionName].filter(Boolean).join(' - ') || 'Not assigned',
    amountReceivedCentavos: payment.amountCentavos,
    remainingBalanceCentavos: payment.remainingBalanceCentavos,
    processedByName: payment.processedByName ?? 'Finance staff',
    allocations: payment.allocations.map((allocation) => ({
      name: allocation.itemName,
      amountCentavos: allocation.amountCentavos,
    })),
    institution: {
      name: institution?.schoolName ?? 'Online School Fees Monitoring & Payment System',
      address: institution?.address ?? 'Fictional capstone demonstration',
      email: institution?.email ?? 'info@schoolfees.example.com',
      phone: institution?.phone ?? '+63 (2) 8123-4567',
    },
  };
}

export class PaymentService {
  static async recordPayment(
    input: OtcPaymentInput | OnlinePaymentInput,
    db: DatabaseInstance = getDb()
  ) {
    const values = paymentPostInputSchema.parse(input);
    const processedByUserId = input.processedByUserId;
    if (values.paymentMethod !== 'MOCK_ONLINE' && !processedByUserId) {
      throw new ValidationError('An authenticated finance user is required to post a payment.');
    }

    const existing = await findPaymentByIdempotencyKey(values.idempotencyKey, db);
    if (existing[0]) return getPayment(existing[0].id, db);

    try {
      const created = await db.transaction(async (tx) => {
        const transactionDb = tx as unknown as DatabaseInstance;
        const duplicate = await findPaymentByIdempotencyKey(values.idempotencyKey, transactionDb);
        if (duplicate[0]) return duplicate[0];

        const student = await lockStudentForLedgerMutation(values.studentId, transactionDb);

        const [ledger, outstandingItems] = await Promise.all([
          selectStudentLedger(values.studentId, transactionDb),
          selectOutstandingItems(values.studentId, transactionDb),
        ]);
        if (values.amountCentavos > ledger.balanceCentavos) {
          throw new ValidationError(
            `Overpayment rejected. Payment amount (${formatCentavos(values.amountCentavos)}) exceeds current outstanding balance (${formatCentavos(ledger.balanceCentavos)}).`
          );
        }

        const allocations = allocatePaymentToItems(values.amountCentavos, outstandingItems);
        const allocatedTotal = allocations.reduce(
          (total, allocation) => addCentavos(total, allocation.amountCentavos),
          0
        );
        if (allocatedTotal !== values.amountCentavos) {
          throw new ValidationError(
            'The payment cannot be allocated to the student’s outstanding assessment items.'
          );
        }

        const firstAllocation = outstandingItems.find(
          (item) => item.id === allocations[0]?.assessmentItemId
        );
        if (!firstAllocation)
          throw new AppError('Payment allocation could not identify an assessment.');

        const [payment] = await tx
          .insert(schema.payments)
          .values({
            studentId: values.studentId,
            assessmentId: firstAllocation.assessmentId,
            amountCentavos: values.amountCentavos,
            paymentMethod: values.paymentMethod,
            referenceNumber: values.referenceNumber ?? null,
            idempotencyKey: values.idempotencyKey,
            status: 'POSTED',
            processedByUserId: processedByUserId ?? null,
          })
          .returning();
        if (!payment) throw new AppError('The payment could not be created.');

        await tx.insert(schema.paymentAllocations).values(
          allocations.map((allocation) => ({
            paymentId: payment.id,
            assessmentItemId: allocation.assessmentItemId,
            amountCentavos: allocation.amountCentavos,
          }))
        );
        await tx.insert(schema.ledgerEntries).values({
          studentId: values.studentId,
          assessmentId: firstAllocation.assessmentId,
          entryType: 'PAYMENT',
          debitCentavos: 0,
          creditCentavos: values.amountCentavos,
          balanceCentavos: subtractCentavos(ledger.balanceCentavos, values.amountCentavos),
          description: `Payment ${payment.id}`,
        });

        const { receiptNumber } = await allocateReceiptNumber(transactionDb, payment.createdAt);
        const verificationIdentifier = `VER-${payment.id}`;
        const [receipt] = await tx
          .insert(schema.receipts)
          .values({
            paymentId: payment.id,
            receiptNumber,
            verificationIdentifier,
            status: 'ACTIVE',
          })
          .returning();
        if (!receipt) throw new AppError('The payment receipt could not be created.');

        await insertAuditLog(transactionDb, {
          userId: processedByUserId,
          action: 'PAYMENT_POSTED',
          entityType: 'PAYMENT',
          entityId: payment.id,
          details: {
            amountCentavos: values.amountCentavos,
            paymentMethod: values.paymentMethod,
            allocationCount: allocations.length,
            idempotencyKey: values.idempotencyKey,
          },
        });
        await insertAuditLog(transactionDb, {
          userId: processedByUserId,
          action: 'RECEIPT_ISSUED',
          entityType: 'RECEIPT',
          entityId: receipt.id,
          details: { paymentId: payment.id, receiptNumber },
        });
        return payment;
      });

      const payment = await getPayment(created.id, db);
      if (!('skipNotifications' in input && input.skipNotifications)) {
        await NotificationService.notifyPaymentSuccessful(
          created.id,
          db,
          input.notificationProvider
        );
      }
      return payment;
    } catch (error) {
      if (isUniqueViolation(error)) {
        const replay = await findPaymentByIdempotencyKey(values.idempotencyKey, db);
        if (replay[0]) return getPayment(replay[0].id, db);
      }
      throw error;
    }
  }

  static async reversePayment(input: ReversalInput, db: DatabaseInstance = getDb()) {
    const values = reversalPostInputSchema.parse(input);
    const reversedByUserId = input.reversedByUserId;
    if (!reversedByUserId) {
      throw new ValidationError('An authenticated administrator is required to reverse a payment.');
    }

    const result = await db.transaction(async (tx) => {
      const transactionDb = tx as unknown as DatabaseInstance;
      const paymentRows = await tx
        .select({
          id: schema.payments.id,
          studentId: schema.payments.studentId,
          assessmentId: schema.payments.assessmentId,
          amountCentavos: schema.payments.amountCentavos,
          status: schema.payments.status,
          receiptId: schema.receipts.id,
        })
        .from(schema.payments)
        .innerJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
        .where(eq(schema.payments.id, values.paymentId))
        .limit(1);
      const payment = paymentRows[0];
      if (!payment) throw new NotFoundError('The posted payment or receipt does not exist.');
      if (payment.status === 'REVERSED') {
        throw new ValidationError(
          'Payment has already been reversed. Double reversals are prohibited.'
        );
      }
      if (payment.status !== 'POSTED') {
        throw new ValidationError('Only a posted payment can be reversed.');
      }

      await lockStudentForLedgerMutation(payment.studentId, transactionDb);

      const existingReversal = await tx
        .select({ id: schema.paymentReversals.id })
        .from(schema.paymentReversals)
        .where(eq(schema.paymentReversals.paymentId, payment.id))
        .limit(1);
      if (existingReversal[0]) {
        throw new ValidationError(
          'Payment has already been reversed. Double reversals are prohibited.'
        );
      }

      const ledger = await selectStudentLedger(payment.studentId, transactionDb);
      const nextBalance = addCentavos(ledger.balanceCentavos, payment.amountCentavos);
      const [reversal] = await tx
        .insert(schema.paymentReversals)
        .values({
          paymentId: payment.id,
          receiptId: payment.receiptId,
          reason: values.reason,
          reversedByUserId,
        })
        .returning();
      if (!reversal) throw new AppError('The payment reversal could not be created.');

      await tx
        .update(schema.payments)
        .set({ status: 'REVERSED', updatedAt: new Date() })
        .where(eq(schema.payments.id, payment.id));
      await tx
        .update(schema.receipts)
        .set({ status: 'VOIDED' })
        .where(eq(schema.receipts.id, payment.receiptId));
      await tx.insert(schema.ledgerEntries).values({
        studentId: payment.studentId,
        assessmentId: payment.assessmentId,
        entryType: 'REVERSAL',
        debitCentavos: payment.amountCentavos,
        creditCentavos: 0,
        balanceCentavos: nextBalance,
        description: `Reversal for payment ${payment.id}`,
      });
      await insertAuditLog(transactionDb, {
        userId: reversedByUserId,
        action: 'PAYMENT_REVERSED',
        entityType: 'PAYMENT',
        entityId: payment.id,
        details: {
          reversalId: reversal.id,
          receiptId: payment.receiptId,
          reason: values.reason,
          restoredAmountCentavos: payment.amountCentavos,
        },
      });

      return {
        reversalId: reversal.id,
        paymentId: payment.id,
        receiptId: payment.receiptId,
        paymentStatus: 'REVERSED' as const,
        receiptStatus: 'VOIDED' as const,
        balanceCentavos: nextBalance,
      };
    });
    await NotificationService.notifyPaymentReversed(result.paymentId, db);
    return result;
  }
}
