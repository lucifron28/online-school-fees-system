import { randomUUID } from 'node:crypto';
import { and, eq, or } from 'drizzle-orm';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { mockCallbackInputSchema, type MockCallbackInput } from '@/lib/portal';
import { AppError, ConflictError, NotFoundError, ValidationError } from '@/server/errors/index';
import { assertMockPaymentHarnessEnabled } from './mock-payment-harness';
import { NotificationService } from './notification.service';
import { PaymentService } from './payment.service';

export interface CheckoutInput {
  studentId: string;
  assessmentId?: string | null;
  amountCentavos: number;
  paymentChannel: 'GCash' | 'Maya' | 'CreditCard';
  idempotencyKey: string;
  parentUserId: string;
}

export interface CheckoutResult {
  checkoutId: string;
  paymentReference: string;
  redirectUrl: string;
  status: (typeof schema.mockPaymentCheckouts.$inferSelect)['status'];
}

export interface PaymentVerification {
  paymentReference: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING';
  amountCentavos: number;
  studentId: string;
  paidAt?: Date;
  isAlreadyProcessed?: boolean;
}

export interface PaymentGateway {
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyPayment(paymentReference: string): Promise<PaymentVerification>;
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function normalizeAssessmentId(assessmentId: string | null | undefined) {
  return assessmentId ?? null;
}

function assertCheckoutCompatible(
  existing: {
    studentId: string;
    assessmentId: string | null;
    amountCentavos: number;
    paymentChannel: string;
  },
  requested: CheckoutInput
) {
  const sameRequest =
    existing.studentId === requested.studentId &&
    normalizeAssessmentId(existing.assessmentId) ===
      normalizeAssessmentId(requested.assessmentId) &&
    existing.amountCentavos === requested.amountCentavos &&
    existing.paymentChannel === requested.paymentChannel;
  if (!sameRequest) {
    throw new ConflictError(
      'The checkout idempotency key was already used for a different student, assessment, amount, or payment channel.'
    );
  }
}

function statusForCheckout(status: (typeof schema.mockPaymentCheckouts.$inferSelect)['status']) {
  if (status === 'SUCCEEDED') return 'SUCCESS' as const;
  if (status === 'FAILED') return 'FAILED' as const;
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'CANCELLED' as const;
  return 'PENDING' as const;
}

function eventTypeForStatus(status: MockCallbackInput['status']) {
  return {
    SUCCESS: 'PAYMENT_SUCCEEDED',
    FAILED: 'PAYMENT_FAILED',
    CANCELLED: 'PAYMENT_CANCELLED',
    PENDING: 'PAYMENT_PENDING',
  }[status] as (typeof schema.mockPaymentCallbackEvents.$inferInsert)['eventType'];
}

function callbackMatchesTerminalCheckout(
  checkoutStatus: (typeof schema.mockPaymentCheckouts.$inferSelect)['status'],
  callbackStatus: MockCallbackInput['status']
) {
  return (
    (checkoutStatus === 'SUCCEEDED' && callbackStatus === 'SUCCESS') ||
    (checkoutStatus === 'FAILED' && callbackStatus === 'FAILED') ||
    (checkoutStatus === 'CANCELLED' && callbackStatus === 'CANCELLED')
  );
}

async function selectCheckoutByReference(
  reference: string,
  db: DatabaseInstance,
  lockForUpdate = false
) {
  const query = db
    .select()
    .from(schema.mockPaymentCheckouts)
    .where(eq(schema.mockPaymentCheckouts.checkoutReference, reference));
  const rows = lockForUpdate ? await query.for('update').limit(1) : await query.limit(1);
  if (!rows[0]) throw new NotFoundError('The mock payment checkout does not exist.');
  return rows[0];
}

async function expireCheckoutIfNeeded(
  checkout: typeof schema.mockPaymentCheckouts.$inferSelect,
  db: DatabaseInstance,
  now: Date
) {
  if (checkout.status !== 'CREATED' || !checkout.expiresAt || checkout.expiresAt > now) {
    return checkout;
  }

  const [expired] = await db
    .update(schema.mockPaymentCheckouts)
    .set({ status: 'EXPIRED', updatedAt: now })
    .where(
      and(
        eq(schema.mockPaymentCheckouts.id, checkout.id),
        eq(schema.mockPaymentCheckouts.status, 'CREATED')
      )
    )
    .returning();
  return expired ?? { ...checkout, status: 'EXPIRED' as const, updatedAt: now };
}

async function selectExistingCallback(input: MockCallbackInput, db: DatabaseInstance) {
  const rows = await db
    .select({
      event: schema.mockPaymentCallbackEvents,
      checkout: schema.mockPaymentCheckouts,
    })
    .from(schema.mockPaymentCallbackEvents)
    .innerJoin(
      schema.mockPaymentCheckouts,
      eq(schema.mockPaymentCheckouts.id, schema.mockPaymentCallbackEvents.checkoutId)
    )
    .where(
      or(
        eq(schema.mockPaymentCallbackEvents.eventId, input.eventId),
        eq(schema.mockPaymentCallbackEvents.idempotencyKey, input.idempotencyKey)
      )
    );
  if (rows.some((row) => row.checkout.checkoutReference !== input.paymentReference)) {
    throw new ValidationError(
      'The callback event or idempotency key was already used for another checkout.'
    );
  }
  return rows[0];
}

function callbackResult(
  checkout: typeof schema.mockPaymentCheckouts.$inferSelect,
  input: MockCallbackInput,
  duplicate: boolean,
  eventStatus: (typeof schema.mockPaymentCallbackEvents.$inferSelect)['processingStatus'] = 'PROCESSED',
  errorMessage?: string | null
) {
  return {
    status: eventStatus === 'FAILED' ? 'failed' : 'ok',
    paymentReference: input.paymentReference,
    verificationStatus: statusForCheckout(checkout.status),
    checkoutStatus: checkout.status,
    paymentId: checkout.paymentId,
    isAlreadyProcessed: duplicate,
    duplicatePrevented: duplicate,
    error: errorMessage ?? undefined,
  };
}

export class MockPaymentGateway implements PaymentGateway {
  constructor(private readonly db?: DatabaseInstance) {}

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    assertMockPaymentHarnessEnabled();
    const db = this.db ?? getDb();
    if (input.amountCentavos <= 0) {
      throw new ValidationError('Checkout amount must be greater than zero.');
    }

    const existing = await db
      .select()
      .from(schema.mockPaymentCheckouts)
      .where(eq(schema.mockPaymentCheckouts.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing[0]) {
      assertCheckoutCompatible(existing[0], input);
      return this.checkoutResult(existing[0]);
    }

    try {
      const [checkout] = await db
        .insert(schema.mockPaymentCheckouts)
        .values({
          checkoutReference: `MOCK-${randomUUID()}`,
          idempotencyKey: input.idempotencyKey,
          studentId: input.studentId,
          assessmentId: input.assessmentId ?? null,
          paymentChannel: input.paymentChannel,
          amountCentavos: input.amountCentavos,
          status: 'CREATED',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        })
        .returning();
      if (!checkout) throw new AppError('The mock payment checkout could not be created.');
      return this.checkoutResult(checkout);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const replay = await db
          .select()
          .from(schema.mockPaymentCheckouts)
          .where(eq(schema.mockPaymentCheckouts.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (replay[0]) {
          assertCheckoutCompatible(replay[0], input);
          return this.checkoutResult(replay[0]);
        }
      }
      throw error;
    }
  }

  async verifyPayment(paymentReference: string): Promise<PaymentVerification> {
    assertMockPaymentHarnessEnabled();
    const checkout = await getMockCheckout(paymentReference, this.db ?? getDb());
    return {
      paymentReference: checkout.checkoutReference,
      status: statusForCheckout(checkout.status),
      amountCentavos: checkout.amountCentavos,
      studentId: checkout.studentId,
      paidAt: checkout.completedAt ?? undefined,
      isAlreadyProcessed: checkout.status !== 'CREATED',
    };
  }

  private checkoutResult(
    checkout: typeof schema.mockPaymentCheckouts.$inferSelect
  ): CheckoutResult {
    return {
      checkoutId: checkout.id,
      paymentReference: checkout.checkoutReference,
      redirectUrl: `/parent/pay/mock-checkout?ref=${encodeURIComponent(checkout.checkoutReference)}`,
      status: checkout.status,
    };
  }
}

export async function getMockCheckout(paymentReference: string, db?: DatabaseInstance) {
  assertMockPaymentHarnessEnabled();
  const database = db ?? getDb();
  return database.transaction(async (tx) => {
    const transactionDb = tx as unknown as DatabaseInstance;
    const checkout = await selectCheckoutByReference(paymentReference, transactionDb, true);
    return expireCheckoutIfNeeded(checkout, transactionDb, new Date());
  });
}

export async function processMockCallback(input: MockCallbackInput, db?: DatabaseInstance) {
  assertMockPaymentHarnessEnabled();
  db ??= getDb();
  const values = mockCallbackInputSchema.parse(input);
  const existing = await selectExistingCallback(values, db);
  if (existing) {
    return callbackResult(
      existing.checkout,
      values,
      true,
      existing.event.processingStatus,
      existing.event.errorMessage
    );
  }

  try {
    const callbackResponse = await db.transaction(async (tx) => {
      const transactionDb = tx as unknown as DatabaseInstance;
      const duplicate = await selectExistingCallback(values, transactionDb);
      if (duplicate) {
        return callbackResult(
          duplicate.checkout,
          values,
          true,
          duplicate.event.processingStatus,
          duplicate.event.errorMessage
        );
      }

      let checkout = await selectCheckoutByReference(values.paymentReference, transactionDb, true);
      const [event] = await tx
        .insert(schema.mockPaymentCallbackEvents)
        .values({
          checkoutId: checkout.id,
          eventId: values.eventId,
          idempotencyKey: values.idempotencyKey,
          eventType: eventTypeForStatus(values.status),
          payload: values,
          processingStatus: 'RECEIVED',
        })
        .returning();
      if (!event) throw new AppError('The mock callback event could not be recorded.');

      checkout = await expireCheckoutIfNeeded(checkout, transactionDb, new Date());
      if (checkout.status === 'EXPIRED') {
        const message = 'The mock checkout expired before callback processing.';
        await tx
          .update(schema.mockPaymentCallbackEvents)
          .set({ processingStatus: 'FAILED', processedAt: new Date(), errorMessage: message })
          .where(eq(schema.mockPaymentCallbackEvents.id, event.id));
        return callbackResult(checkout, values, false, 'FAILED', message);
      }

      if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(checkout.status)) {
        const matches = callbackMatchesTerminalCheckout(checkout.status, values.status);
        const message = matches
          ? null
          : 'The checkout is already terminal; its state and financial history cannot change.';
        const processingStatus = matches ? 'PROCESSED' : 'FAILED';
        await tx
          .update(schema.mockPaymentCallbackEvents)
          .set({
            processingStatus,
            processedAt: new Date(),
            errorMessage: message,
          })
          .where(eq(schema.mockPaymentCallbackEvents.id, event.id));
        return callbackResult(checkout, values, false, processingStatus, message);
      }

      if (checkout.status === 'SUCCEEDED' && values.status !== 'SUCCESS') {
        const message = 'A successfully completed checkout cannot be downgraded.';
        await tx
          .update(schema.mockPaymentCallbackEvents)
          .set({ processingStatus: 'FAILED', processedAt: new Date(), errorMessage: message })
          .where(eq(schema.mockPaymentCallbackEvents.id, event.id));
        return callbackResult(checkout, values, false, 'FAILED', message);
      }

      if (values.status === 'PENDING') {
        const [updatedCheckout] = await tx
          .update(schema.mockPaymentCheckouts)
          .set({ updatedAt: new Date() })
          .where(eq(schema.mockPaymentCheckouts.id, checkout.id))
          .returning();
        await tx
          .update(schema.mockPaymentCallbackEvents)
          .set({ processingStatus: 'PROCESSED', processedAt: new Date() })
          .where(eq(schema.mockPaymentCallbackEvents.id, event.id));
        return callbackResult(updatedCheckout ?? checkout, values, false);
      }

      if (
        values.status === 'SUCCESS' &&
        ['FAILED', 'CANCELLED', 'EXPIRED'].includes(checkout.status)
      ) {
        const message = 'A terminally failed or cancelled checkout cannot be completed.';
        await tx
          .update(schema.mockPaymentCallbackEvents)
          .set({ processingStatus: 'FAILED', processedAt: new Date(), errorMessage: message })
          .where(eq(schema.mockPaymentCallbackEvents.id, event.id));
        return callbackResult(checkout, values, false, 'FAILED', message);
      }

      if (values.status === 'SUCCESS') {
        try {
          const payment = await PaymentService.recordPayment(
            {
              studentId: checkout.studentId,
              amountCentavos: checkout.amountCentavos,
              paymentMethod: 'MOCK_ONLINE',
              referenceNumber: checkout.checkoutReference,
              idempotencyKey: `mock-online-${checkout.id}`,
              skipNotifications: true,
            },
            transactionDb
          );
          const [updatedCheckout] = await tx
            .update(schema.mockPaymentCheckouts)
            .set({
              status: 'SUCCEEDED',
              paymentId: payment.id,
              completedAt: payment.createdAt,
              updatedAt: new Date(),
            })
            .where(eq(schema.mockPaymentCheckouts.id, checkout.id))
            .returning();
          await tx
            .update(schema.mockPaymentCallbackEvents)
            .set({ processingStatus: 'PROCESSED', processedAt: new Date() })
            .where(eq(schema.mockPaymentCallbackEvents.id, event.id));
          return callbackResult(updatedCheckout ?? checkout, values, false);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Online payment failed.';
          await tx
            .update(schema.mockPaymentCheckouts)
            .set({ status: 'FAILED', updatedAt: new Date() })
            .where(eq(schema.mockPaymentCheckouts.id, checkout.id));
          await tx
            .update(schema.mockPaymentCallbackEvents)
            .set({ processingStatus: 'FAILED', processedAt: new Date(), errorMessage: message })
            .where(eq(schema.mockPaymentCallbackEvents.id, event.id));
          const failedCheckout = { ...checkout, status: 'FAILED' as const };
          return callbackResult(failedCheckout, values, false, 'FAILED', message);
        }
      }

      const checkoutStatus = values.status === 'FAILED' ? 'FAILED' : 'CANCELLED';
      const [updatedCheckout] = await tx
        .update(schema.mockPaymentCheckouts)
        .set({ status: checkoutStatus, updatedAt: new Date() })
        .where(eq(schema.mockPaymentCheckouts.id, checkout.id))
        .returning();
      await tx
        .update(schema.mockPaymentCallbackEvents)
        .set({ processingStatus: 'PROCESSED', processedAt: new Date() })
        .where(eq(schema.mockPaymentCallbackEvents.id, event.id));
      return callbackResult(updatedCheckout ?? checkout, values, false);
    });
    if (values.status === 'SUCCESS' && callbackResponse.paymentId) {
      await NotificationService.notifyPaymentSuccessful(callbackResponse.paymentId);
    }
    return callbackResponse;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const replay = await selectExistingCallback(values, db);
      if (replay) {
        return callbackResult(
          replay.checkout,
          values,
          true,
          replay.event.processingStatus,
          replay.event.errorMessage
        );
      }
    }
    throw error;
  }
}
