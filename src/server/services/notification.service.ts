import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import type { NotificationType } from '@/lib/notifications';
import { formatCentavos } from '@/lib/utils/currency';
import { getServerEnv } from '@/lib/env';
import { NotFoundError } from '@/server/errors';

const MAX_AUTOMATIC_ATTEMPTS = 3;

type NotificationChannel = (typeof schema.notificationChannelEnum.enumValues)[number];
type NotificationStatus = (typeof schema.notificationDeliveryStatusEnum.enumValues)[number];
type NotificationRecord = typeof schema.notifications.$inferSelect;
type DeliveryRecord = typeof schema.notificationDeliveries.$inferSelect;

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProviderResult {
  providerMessageId?: string | null;
}

export interface EmailProvider {
  readonly channel: NotificationChannel;
  send(message: EmailMessage): Promise<EmailProviderResult>;
}

export class ConsoleEmailProvider implements EmailProvider {
  readonly channel = 'CONSOLE' as const;

  async send(message: EmailMessage): Promise<EmailProviderResult> {
    console.info(
      '[notification:console]',
      JSON.stringify({ to: message.to, subject: message.subject, text: message.text })
    );
    return { providerMessageId: `console-${randomUUID()}` };
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly channel = 'EMAIL' as const;
  private readonly client: Resend;

  constructor(
    private readonly apiKey: string,
    private readonly from: string
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<EmailProviderResult> {
    const result = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    if (result.error) throw new Error(result.error.message);
    return { providerMessageId: result.data?.id ?? null };
  }
}

export function getEmailProvider(): EmailProvider {
  const env = getServerEnv();
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  return new ConsoleEmailProvider();
}

export interface NotificationRecipient {
  userId: string;
  name: string;
  email: string;
}

export interface EnqueueNotificationInput {
  userId: string;
  type: NotificationType;
  dedupeKey: string;
  entityType?: string | null;
  entityId?: string | null;
  title: string;
  body: string;
}

export interface NotificationDispatchSummary {
  attempted: number;
  created: number;
  deduplicated: number;
  sent: number;
  retrying: number;
  failed: number;
}

function emptySummary(): NotificationDispatchSummary {
  return { attempted: 0, created: 0, deduplicated: 0, sent: 0, retrying: 0, failed: 0 };
}

function combineSummaries(...summaries: NotificationDispatchSummary[]) {
  return summaries.reduce<NotificationDispatchSummary>(
    (total, summary) => ({
      attempted: total.attempted + summary.attempted,
      created: total.created + summary.created,
      deduplicated: total.deduplicated + summary.deduplicated,
      sent: total.sent + summary.sent,
      retrying: total.retrying + summary.retrying,
      failed: total.failed + summary.failed,
    }),
    emptySummary()
  );
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

async function selectNotificationByDedupeKey(dedupeKey: string, db: DatabaseInstance) {
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.dedupeKey, dedupeKey))
    .limit(1);
  return rows[0] ?? null;
}

async function selectNotification(notificationId: string, db: DatabaseInstance) {
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.id, notificationId))
    .limit(1);
  if (!rows[0]) throw new NotFoundError('The notification does not exist.');
  return rows[0];
}

async function selectDelivery(notificationId: string, db: DatabaseInstance) {
  const rows = await db
    .select()
    .from(schema.notificationDeliveries)
    .where(eq(schema.notificationDeliveries.notificationId, notificationId))
    .limit(1);
  return rows[0] ?? null;
}

async function selectRecipient(userId: string, db: DatabaseInstance) {
  const rows = await db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

async function selectStudentRecipients(studentId: string, db: DatabaseInstance) {
  const [studentRows, guardianRows] = await Promise.all([
    db
      .select({
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.students)
      .innerJoin(schema.users, eq(schema.users.id, schema.students.userId))
      .where(eq(schema.students.id, studentId)),
    db
      .select({
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.guardianStudents)
      .innerJoin(schema.guardians, eq(schema.guardians.id, schema.guardianStudents.guardianId))
      .innerJoin(schema.users, eq(schema.users.id, schema.guardians.userId))
      .where(eq(schema.guardianStudents.studentId, studentId)),
  ]);

  const recipients = new Map<string, NotificationRecipient>();
  for (const recipient of [...studentRows, ...guardianRows]) {
    recipients.set(recipient.userId, recipient);
  }
  return [...recipients.values()];
}

async function attemptDelivery(
  notification: NotificationRecord,
  delivery: DeliveryRecord,
  db: DatabaseInstance,
  provider: EmailProvider
) {
  const attemptCount = delivery.attemptCount + 1;
  const attemptedAt = new Date();
  const claimed = await db
    .update(schema.notificationDeliveries)
    .set({
      status: 'RETRYING',
      attemptCount,
      lastAttemptAt: attemptedAt,
      nextAttemptAt: null,
      errorMessage: null,
      updatedAt: attemptedAt,
    })
    .where(
      and(
        eq(schema.notificationDeliveries.id, delivery.id),
        eq(schema.notificationDeliveries.status, 'PENDING')
      )
    )
    .returning({ id: schema.notificationDeliveries.id });
  if (claimed.length === 0) return selectDelivery(notification.id, db);

  try {
    const recipient = notification.userId ? await selectRecipient(notification.userId, db) : null;
    if (!recipient?.email) throw new Error('The notification recipient has no email address.');

    const result = await provider.send({
      to: recipient.email,
      subject: notification.title,
      text: notification.body,
    });
    const sentAt = new Date();
    await db
      .update(schema.notificationDeliveries)
      .set({
        status: 'SENT',
        providerMessageId: result.providerMessageId ?? null,
        sentAt,
        nextAttemptAt: null,
        errorMessage: null,
        updatedAt: sentAt,
      })
      .where(eq(schema.notificationDeliveries.id, delivery.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notification delivery failed.';
    const status: NotificationStatus =
      attemptCount >= MAX_AUTOMATIC_ATTEMPTS ? 'FAILED' : 'RETRYING';
    const nextAttemptAt =
      status === 'RETRYING'
        ? new Date(attemptedAt.getTime() + 2 ** attemptCount * 60 * 1000)
        : null;
    await db
      .update(schema.notificationDeliveries)
      .set({ status, nextAttemptAt, errorMessage: message, updatedAt: new Date() })
      .where(eq(schema.notificationDeliveries.id, delivery.id));
  }

  return selectDelivery(notification.id, db);
}

export async function enqueueNotification(
  input: EnqueueNotificationInput,
  db: DatabaseInstance = getDb(),
  provider: EmailProvider = getEmailProvider()
) {
  let notification: NotificationRecord | null = null;
  let deduplicated = false;

  const inserted = await db
    .insert(schema.notifications)
    .values({
      userId: input.userId,
      type: input.type,
      dedupeKey: input.dedupeKey,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      title: input.title,
      body: input.body,
    })
    .onConflictDoNothing()
    .returning();
  notification = inserted[0] ?? null;

  if (!notification) {
    deduplicated = true;
    notification = await selectNotificationByDedupeKey(input.dedupeKey, db);
  }
  if (!notification) throw new Error('The notification could not be persisted.');

  let delivery = await selectDelivery(notification.id, db);
  if (!delivery) {
    try {
      const createdDelivery = await db
        .insert(schema.notificationDeliveries)
        .values({ notificationId: notification.id, channel: provider.channel })
        .onConflictDoNothing()
        .returning();
      delivery = createdDelivery[0] ?? null;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      delivery = await selectDelivery(notification.id, db);
    }
  }
  if (!delivery) throw new Error('The notification delivery could not be persisted.');

  if (delivery.status === 'PENDING') {
    delivery = await attemptDelivery(notification, delivery, db, provider);
  }

  return {
    notification,
    delivery,
    deduplicated,
  };
}

async function dispatchToRecipients(
  recipients: NotificationRecipient[],
  input: Omit<EnqueueNotificationInput, 'userId'>,
  db: DatabaseInstance,
  provider: EmailProvider
) {
  const summary = emptySummary();
  summary.attempted = recipients.length;

  for (const recipient of recipients) {
    try {
      const result = await enqueueNotification(
        { ...input, userId: recipient.userId, dedupeKey: `${input.dedupeKey}:${recipient.userId}` },
        db,
        provider
      );
      if (result.deduplicated) summary.deduplicated += 1;
      else summary.created += 1;
      if (result.delivery?.status === 'SENT') summary.sent += 1;
      else if (result.delivery?.status === 'FAILED') summary.failed += 1;
      else summary.retrying += 1;
    } catch (error) {
      summary.failed += 1;
      console.error('Notification persistence failed', error);
    }
  }
  return summary;
}

async function selectAssessmentContext(assessmentId: string, db: DatabaseInstance) {
  const rows = await db
    .select({
      id: schema.studentAssessments.id,
      studentId: schema.studentAssessments.studentId,
      studentName: schema.students.firstName,
      studentLastName: schema.students.lastName,
      totalAmountCentavos: schema.studentAssessments.totalAmountCentavos,
      assessmentPeriod: schema.studentAssessments.assessmentPeriod,
      feeStructureName: schema.feeStructures.name,
    })
    .from(schema.studentAssessments)
    .innerJoin(schema.students, eq(schema.students.id, schema.studentAssessments.studentId))
    .innerJoin(
      schema.feeStructures,
      eq(schema.feeStructures.id, schema.studentAssessments.feeStructureId)
    )
    .where(eq(schema.studentAssessments.id, assessmentId))
    .limit(1);
  return rows[0] ?? null;
}

async function selectPaymentContext(paymentId: string, db: DatabaseInstance) {
  const rows = await db
    .select({
      id: schema.payments.id,
      studentId: schema.payments.studentId,
      studentName: schema.students.firstName,
      studentLastName: schema.students.lastName,
      amountCentavos: schema.payments.amountCentavos,
      paymentMethod: schema.payments.paymentMethod,
      status: schema.payments.status,
      receiptId: schema.receipts.id,
      receiptNumber: schema.receipts.receiptNumber,
    })
    .from(schema.payments)
    .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
    .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
    .where(eq(schema.payments.id, paymentId))
    .limit(1);
  return rows[0] ?? null;
}

async function selectReversalContext(paymentId: string, db: DatabaseInstance) {
  const rows = await db
    .select({
      id: schema.payments.id,
      studentId: schema.payments.studentId,
      studentName: schema.students.firstName,
      studentLastName: schema.students.lastName,
      amountCentavos: schema.payments.amountCentavos,
      reason: schema.paymentReversals.reason,
    })
    .from(schema.paymentReversals)
    .innerJoin(schema.payments, eq(schema.payments.id, schema.paymentReversals.paymentId))
    .innerJoin(schema.students, eq(schema.students.id, schema.payments.studentId))
    .where(eq(schema.paymentReversals.paymentId, paymentId))
    .limit(1);
  return rows[0] ?? null;
}

export class NotificationService {
  static async notifyAssessmentPosted(
    assessmentId: string,
    db: DatabaseInstance = getDb(),
    provider: EmailProvider = getEmailProvider()
  ) {
    try {
      const assessment = await selectAssessmentContext(assessmentId, db);
      if (!assessment) return emptySummary();
      const recipients = await selectStudentRecipients(assessment.studentId, db);
      const studentName = `${assessment.studentName} ${assessment.studentLastName}`;
      return dispatchToRecipients(
        recipients,
        {
          type: 'ASSESSMENT_POSTED',
          dedupeKey: `assessment-posted:${assessment.id}`,
          entityType: 'ASSESSMENT',
          entityId: assessment.id,
          title: `Assessment posted for ${studentName}`,
          body: `${assessment.assessmentPeriod} assessment ${assessment.feeStructureName} was posted for ${studentName}. Amount due: ${formatCentavos(assessment.totalAmountCentavos)}.`,
        },
        db,
        provider
      );
    } catch (error) {
      console.error('Assessment notification dispatch failed', error);
      return emptySummary();
    }
  }

  static async notifyPaymentSuccessful(
    paymentId: string,
    db: DatabaseInstance = getDb(),
    provider: EmailProvider = getEmailProvider()
  ) {
    try {
      const payment = await selectPaymentContext(paymentId, db);
      if (!payment || payment.status !== 'POSTED') return emptySummary();
      const recipients = await selectStudentRecipients(payment.studentId, db);
      const studentName = `${payment.studentName} ${payment.studentLastName}`;
      const paymentSummary = await dispatchToRecipients(
        recipients,
        {
          type: 'PAYMENT_SUCCESSFUL',
          dedupeKey: `payment-successful:${payment.id}`,
          entityType: 'PAYMENT',
          entityId: payment.id,
          title: `Payment received for ${studentName}`,
          body: `${formatCentavos(payment.amountCentavos)} was posted for ${studentName} through ${payment.paymentMethod}.`,
        },
        db,
        provider
      );
      if (!payment.receiptId) return paymentSummary;
      const receiptSummary = await dispatchToRecipients(
        recipients,
        {
          type: 'RECEIPT_AVAILABLE',
          dedupeKey: `receipt-available:${payment.receiptId}`,
          entityType: 'RECEIPT',
          entityId: payment.receiptId,
          title: 'Payment acknowledgment receipt available',
          body: `Payment acknowledgment receipt ${payment.receiptNumber ?? payment.receiptId} is available for ${studentName}.`,
        },
        db,
        provider
      );
      return combineSummaries(paymentSummary, receiptSummary);
    } catch (error) {
      console.error('Payment notification dispatch failed', error);
      return emptySummary();
    }
  }

  static async notifyPaymentReversed(
    paymentId: string,
    db: DatabaseInstance = getDb(),
    provider: EmailProvider = getEmailProvider()
  ) {
    try {
      const reversal = await selectReversalContext(paymentId, db);
      if (!reversal) return emptySummary();
      const recipients = await selectStudentRecipients(reversal.studentId, db);
      const studentName = `${reversal.studentName} ${reversal.studentLastName}`;
      return dispatchToRecipients(
        recipients,
        {
          type: 'PAYMENT_REVERSED',
          dedupeKey: `payment-reversed:${reversal.id}`,
          entityType: 'PAYMENT',
          entityId: reversal.id,
          title: `Payment reversed for ${studentName}`,
          body: `${formatCentavos(reversal.amountCentavos)} was reversed for ${studentName}. Reason: ${reversal.reason}`,
        },
        db,
        provider
      );
    } catch (error) {
      console.error('Payment reversal notification dispatch failed', error);
      return emptySummary();
    }
  }

  static async getHistory(
    input: { userId?: string; limit?: number } = {},
    db: DatabaseInstance = getDb()
  ) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    return db
      .select({
        id: schema.notifications.id,
        userId: schema.notifications.userId,
        userName: schema.users.name,
        userEmail: schema.users.email,
        type: schema.notifications.type,
        dedupeKey: schema.notifications.dedupeKey,
        entityType: schema.notifications.entityType,
        entityId: schema.notifications.entityId,
        title: schema.notifications.title,
        body: schema.notifications.body,
        createdAt: schema.notifications.createdAt,
        deliveryId: schema.notificationDeliveries.id,
        deliveryChannel: schema.notificationDeliveries.channel,
        deliveryStatus: schema.notificationDeliveries.status,
        attemptCount: schema.notificationDeliveries.attemptCount,
        providerMessageId: schema.notificationDeliveries.providerMessageId,
        lastAttemptAt: schema.notificationDeliveries.lastAttemptAt,
        nextAttemptAt: schema.notificationDeliveries.nextAttemptAt,
        sentAt: schema.notificationDeliveries.sentAt,
        errorMessage: schema.notificationDeliveries.errorMessage,
      })
      .from(schema.notifications)
      .leftJoin(schema.users, eq(schema.users.id, schema.notifications.userId))
      .leftJoin(
        schema.notificationDeliveries,
        eq(schema.notificationDeliveries.notificationId, schema.notifications.id)
      )
      .where(input.userId ? eq(schema.notifications.userId, input.userId) : undefined)
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit);
  }

  static async retryNotification(
    notificationId: string,
    db: DatabaseInstance = getDb(),
    provider: EmailProvider = getEmailProvider()
  ) {
    const notification = await selectNotification(notificationId, db);
    const delivery = await selectDelivery(notification.id, db);
    if (!delivery) throw new Error('The notification has no delivery record.');
    if (delivery.status === 'SENT') return delivery;

    await db
      .update(schema.notificationDeliveries)
      .set({ status: 'PENDING', nextAttemptAt: null, updatedAt: new Date() })
      .where(eq(schema.notificationDeliveries.id, delivery.id));
    return attemptDelivery(notification, { ...delivery, status: 'PENDING' }, db, provider);
  }
}
