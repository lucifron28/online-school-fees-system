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
import { AppError, ConflictError, NotFoundError, ValidationError } from '@/server/errors';
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

type PaymentObligation = AllocationItem & {
  assessmentId: string;
  targetType: 'ASSESSMENT_ITEM' | 'DEBIT_ADJUSTMENT';
  assessmentItemId: string | null;
  adjustmentId: string | null;
  createdAt: Date;
  assessmentCreatedAt: Date;
};

type PaymentAllocation = {
  assessmentItemId: string | null;
  adjustmentId: string | null;
  assessmentId: string;
  targetType: 'ASSESSMENT_ITEM' | 'DEBIT_ADJUSTMENT';
  name: string;
  amountCentavos: number;
};

type AllocationGroup = {
  assessmentId: string;
  amountCentavos: number;
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

/**
 * Allocate oldest-first across every persisted positive payment obligation.
 * Assessment items and DEBIT adjustments are both payable targets; CREDIT
 * adjustments never enter this list. The caller must provide database-derived
 * obligations sorted by assessment creation, target creation, and target id.
 */
export function allocatePaymentToObligations(
  paymentAmountCentavos: number,
  obligations: PaymentObligation[]
): PaymentAllocation[] {
  let remainingPayment = paymentAmountCentavos;
  const allocations: PaymentAllocation[] = [];

  for (const obligation of obligations) {
    if (remainingPayment <= 0) break;

    const unpaidAmount = subtractCentavos(obligation.amountCentavos, obligation.paidCentavos);
    if (unpaidAmount <= 0) continue;

    const allocated = Math.min(remainingPayment, unpaidAmount);
    allocations.push({
      assessmentItemId: obligation.assessmentItemId,
      adjustmentId: obligation.adjustmentId,
      assessmentId: obligation.assessmentId,
      targetType: obligation.targetType,
      name: obligation.name,
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
    .select({
      id: schema.payments.id,
      studentId: schema.payments.studentId,
      amountCentavos: schema.payments.amountCentavos,
      paymentMethod: schema.payments.paymentMethod,
      referenceNumber: schema.payments.referenceNumber,
    })
    .from(schema.payments)
    .where(eq(schema.payments.idempotencyKey, idempotencyKey))
    .limit(1);
}

function normalizeReferenceNumber(referenceNumber: string | null | undefined) {
  const normalized = referenceNumber?.trim();
  return normalized || null;
}

function assertPaymentRequestCompatible(
  existing: {
    studentId: string;
    amountCentavos: number;
    paymentMethod: string;
    referenceNumber: string | null;
  },
  requested: PaymentPostInput
) {
  const sameRequest =
    existing.studentId === requested.studentId &&
    existing.amountCentavos === requested.amountCentavos &&
    existing.paymentMethod === requested.paymentMethod &&
    normalizeReferenceNumber(existing.referenceNumber) ===
      normalizeReferenceNumber(requested.referenceNumber);
  if (!sameRequest) {
    throw new ConflictError(
      'The payment idempotency key was already used for a different student, amount, method, or reference.'
    );
  }
}

function groupAllocationsByAssessment(allocations: PaymentAllocation[]): AllocationGroup[] {
  const groups = new Map<string, AllocationGroup>();
  for (const allocation of allocations) {
    const current = groups.get(allocation.assessmentId) ?? {
      assessmentId: allocation.assessmentId,
      amountCentavos: 0,
    };
    current.amountCentavos = addCentavos(current.amountCentavos, allocation.amountCentavos);
    groups.set(allocation.assessmentId, current);
  }
  return [...groups.values()];
}

async function selectOutstandingObligations(
  studentId: string,
  db: DatabaseInstance
): Promise<PaymentObligation[]> {
  const [items, adjustments] = await Promise.all([
    db
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
      ),
    db
      .select({
        assessmentId: schema.studentAssessments.id,
        adjustmentId: schema.adjustments.id,
        name: schema.adjustments.reason,
        amountCentavos: schema.adjustments.amountCentavos,
        assessmentCreatedAt: schema.studentAssessments.createdAt,
        adjustmentCreatedAt: schema.adjustments.createdAt,
      })
      .from(schema.adjustments)
      .innerJoin(
        schema.studentAssessments,
        eq(schema.studentAssessments.id, schema.adjustments.assessmentId)
      )
      .where(
        and(
          eq(schema.adjustments.studentId, studentId),
          eq(schema.studentAssessments.studentId, studentId),
          eq(schema.adjustments.type, 'DEBIT'),
          eq(schema.studentAssessments.status, 'POSTED')
        )
      ),
  ]);

  if (items.length === 0 && adjustments.length === 0) {
    throw new ValidationError('The student has no posted payment obligations available.');
  }

  const itemIds = items.map((item) => item.assessmentItemId);
  const adjustmentIds = adjustments.map((adjustment) => adjustment.adjustmentId);
  const [itemAllocations, adjustmentAllocations] = await Promise.all([
    itemIds.length === 0
      ? Promise.resolve([])
      : db
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
          ),
    adjustmentIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            adjustmentId: schema.paymentAllocations.adjustmentId,
            amountCentavos: schema.paymentAllocations.amountCentavos,
          })
          .from(schema.paymentAllocations)
          .innerJoin(schema.payments, eq(schema.payments.id, schema.paymentAllocations.paymentId))
          .where(
            and(
              inArray(schema.paymentAllocations.adjustmentId, adjustmentIds),
              eq(schema.payments.status, 'POSTED')
            )
          ),
  ]);
  const paidByItem = new Map<string, number>();
  for (const allocation of itemAllocations) {
    if (!allocation.assessmentItemId) continue;
    paidByItem.set(
      allocation.assessmentItemId,
      addCentavos(paidByItem.get(allocation.assessmentItemId) ?? 0, allocation.amountCentavos)
    );
  }
  const paidByAdjustment = new Map<string, number>();
  for (const allocation of adjustmentAllocations) {
    if (!allocation.adjustmentId) continue;
    paidByAdjustment.set(
      allocation.adjustmentId,
      addCentavos(paidByAdjustment.get(allocation.adjustmentId) ?? 0, allocation.amountCentavos)
    );
  }

  return [
    ...items.map<PaymentObligation>((item) => ({
      id: item.assessmentItemId,
      assessmentId: item.assessmentId,
      name: item.name,
      amountCentavos: item.amountCentavos,
      paidCentavos: paidByItem.get(item.assessmentItemId) ?? 0,
      targetType: 'ASSESSMENT_ITEM',
      assessmentItemId: item.assessmentItemId,
      adjustmentId: null,
      createdAt: item.itemCreatedAt,
      assessmentCreatedAt: item.assessmentCreatedAt,
    })),
    ...adjustments.map<PaymentObligation>((adjustment) => ({
      id: adjustment.adjustmentId,
      assessmentId: adjustment.assessmentId,
      name: adjustment.name,
      amountCentavos: adjustment.amountCentavos,
      paidCentavos: paidByAdjustment.get(adjustment.adjustmentId) ?? 0,
      targetType: 'DEBIT_ADJUSTMENT',
      assessmentItemId: null,
      adjustmentId: adjustment.adjustmentId,
      createdAt: adjustment.adjustmentCreatedAt,
      assessmentCreatedAt: adjustment.assessmentCreatedAt,
    })),
  ].sort(
    (left, right) =>
      left.assessmentCreatedAt.getTime() - right.assessmentCreatedAt.getTime() ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.targetType.localeCompare(right.targetType) ||
      left.id.localeCompare(right.id)
  );
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
        adjustmentId: schema.paymentAllocations.adjustmentId,
        amountCentavos: schema.paymentAllocations.amountCentavos,
        itemAssessmentId: schema.assessmentItems.assessmentId,
        itemName: schema.assessmentItems.name,
        feeCategoryName: schema.feeCategories.name,
        adjustmentAssessmentId: schema.adjustments.assessmentId,
        adjustmentReason: schema.adjustments.reason,
      })
      .from(schema.paymentAllocations)
      .leftJoin(
        schema.assessmentItems,
        eq(schema.assessmentItems.id, schema.paymentAllocations.assessmentItemId)
      )
      .leftJoin(
        schema.feeCategories,
        eq(schema.feeCategories.id, schema.assessmentItems.feeCategoryId)
      )
      .leftJoin(
        schema.adjustments,
        eq(schema.adjustments.id, schema.paymentAllocations.adjustmentId)
      )
      .where(eq(schema.paymentAllocations.paymentId, id))
      .orderBy(asc(schema.paymentAllocations.createdAt)),
    selectStudentLedger(payment.studentId, db),
  ]);

  const allocationDetails = allocations.map((allocation) => ({
    ...allocation,
    assessmentId: allocation.itemAssessmentId ?? allocation.adjustmentAssessmentId,
    itemName: allocation.itemName ?? allocation.adjustmentReason ?? 'Debit adjustment',
    feeCategoryName: allocation.feeCategoryName ?? 'Debit adjustment',
    allocationType: allocation.adjustmentId
      ? ('DEBIT_ADJUSTMENT' as const)
      : ('ASSESSMENT_ITEM' as const),
  }));

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
    allocations: allocationDetails,
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
    if (existing[0]) {
      assertPaymentRequestCompatible(existing[0], values);
      return getPayment(existing[0].id, db);
    }

    try {
      const created = await db.transaction(async (tx) => {
        const transactionDb = tx as unknown as DatabaseInstance;
        const duplicate = await findPaymentByIdempotencyKey(values.idempotencyKey, transactionDb);
        if (duplicate[0]) {
          assertPaymentRequestCompatible(duplicate[0], values);
          return duplicate[0];
        }

        await lockStudentForLedgerMutation(values.studentId, transactionDb);

        const [ledger, outstandingObligations] = await Promise.all([
          selectStudentLedger(values.studentId, transactionDb),
          selectOutstandingObligations(values.studentId, transactionDb),
        ]);
        if (values.amountCentavos > ledger.balanceCentavos) {
          throw new ValidationError(
            `Overpayment rejected. Payment amount (${formatCentavos(values.amountCentavos)}) exceeds current outstanding balance (${formatCentavos(ledger.balanceCentavos)}).`
          );
        }

        const allocations = allocatePaymentToObligations(
          values.amountCentavos,
          outstandingObligations
        );
        const allocatedTotal = allocations.reduce(
          (total, allocation) => addCentavos(total, allocation.amountCentavos),
          0
        );
        if (allocatedTotal !== values.amountCentavos) {
          throw new ValidationError(
            'The payment cannot be allocated to the student’s outstanding assessment items.'
          );
        }

        if (allocations.length === 0) {
          throw new ValidationError('The payment has no outstanding charge target to allocate.');
        }
        const allocationGroups = groupAllocationsByAssessment(allocations);
        const paymentAssessmentId =
          allocationGroups.length === 1 ? allocationGroups[0].assessmentId : null;

        const [payment] = await tx
          .insert(schema.payments)
          .values({
            studentId: values.studentId,
            assessmentId: paymentAssessmentId,
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
            adjustmentId: allocation.adjustmentId,
            amountCentavos: allocation.amountCentavos,
          }))
        );

        for (const [groupIndex, group] of allocationGroups.entries()) {
          await tx.insert(schema.ledgerEntries).values({
            studentId: values.studentId,
            assessmentId: group.assessmentId,
            entryType: 'PAYMENT',
            debitCentavos: 0,
            creditCentavos: group.amountCentavos,
            balanceCentavos: subtractCentavos(
              ledger.balanceCentavos,
              allocationGroups
                .slice(0, groupIndex + 1)
                .reduce((total, current) => addCentavos(total, current.amountCentavos), 0)
            ),
            description: `Payment ${payment.id}`,
            createdAt: new Date(payment.createdAt.getTime() + groupIndex),
          });
        }

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
        if (replay[0]) {
          assertPaymentRequestCompatible(replay[0], values);
          return getPayment(replay[0].id, db);
        }
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
      const originalAllocations = await tx
        .select({
          assessmentItemId: schema.paymentAllocations.assessmentItemId,
          adjustmentId: schema.paymentAllocations.adjustmentId,
          amountCentavos: schema.paymentAllocations.amountCentavos,
          itemAssessmentId: schema.assessmentItems.assessmentId,
          adjustmentAssessmentId: schema.adjustments.assessmentId,
          itemName: schema.assessmentItems.name,
          adjustmentReason: schema.adjustments.reason,
        })
        .from(schema.paymentAllocations)
        .leftJoin(
          schema.assessmentItems,
          eq(schema.assessmentItems.id, schema.paymentAllocations.assessmentItemId)
        )
        .leftJoin(
          schema.adjustments,
          eq(schema.adjustments.id, schema.paymentAllocations.adjustmentId)
        )
        .where(eq(schema.paymentAllocations.paymentId, payment.id))
        .orderBy(asc(schema.paymentAllocations.createdAt));
      const reversalAllocations: PaymentAllocation[] = originalAllocations.map((allocation) => {
        const assessmentId = allocation.itemAssessmentId ?? allocation.adjustmentAssessmentId;
        if (!assessmentId) {
          throw new AppError('The payment allocation is missing its assessment target.');
        }
        if ((allocation.assessmentItemId ? 1 : 0) + (allocation.adjustmentId ? 1 : 0) !== 1) {
          throw new AppError('The payment allocation has an invalid target.');
        }
        return {
          assessmentItemId: allocation.assessmentItemId,
          adjustmentId: allocation.adjustmentId,
          assessmentId,
          targetType: allocation.adjustmentId ? 'DEBIT_ADJUSTMENT' : 'ASSESSMENT_ITEM',
          name: allocation.itemName ?? allocation.adjustmentReason ?? 'Debit adjustment',
          amountCentavos: allocation.amountCentavos,
        };
      });
      const allocationTotal = reversalAllocations.reduce(
        (total, allocation) => addCentavos(total, allocation.amountCentavos),
        0
      );
      if (allocationTotal !== payment.amountCentavos) {
        throw new AppError('The payment allocation total does not match the payment amount.');
      }
      const allocationGroups = groupAllocationsByAssessment(reversalAllocations);
      const nextBalance = addCentavos(ledger.balanceCentavos, allocationTotal);
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
      for (const [groupIndex, group] of allocationGroups.entries()) {
        await tx.insert(schema.ledgerEntries).values({
          studentId: payment.studentId,
          assessmentId: group.assessmentId,
          entryType: 'REVERSAL',
          debitCentavos: group.amountCentavos,
          creditCentavos: 0,
          balanceCentavos: addCentavos(
            ledger.balanceCentavos,
            allocationGroups
              .slice(0, groupIndex + 1)
              .reduce((total, current) => addCentavos(total, current.amountCentavos), 0)
          ),
          description: `Reversal for payment ${payment.id}`,
          createdAt: new Date(reversal.createdAt.getTime() + groupIndex),
        });
      }
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
