import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import {
  getOrCreateSchoolSettings,
  isStudentPortalEnabled,
} from '@/server/services/administration.service';
import { evaluateDeadline } from '@/lib/deadlines';
import { getManilaDateString } from '@/lib/reports';
import type { NotificationType } from '@/lib/notifications';
import { addCentavos, formatCentavos, subtractCentavos } from '@/lib/utils/currency';
import { getServerEnv } from '@/lib/env';
import { NotFoundError } from '@/server/errors';
import { logSanitizedError } from '@/server/logging';

// There is no scheduler in this scope. This is the maximum persisted delivery
// attempts shared by the initial dispatch and explicit manual retries.
const MAX_DELIVERY_ATTEMPTS = 3;

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

function calculateLedgerBalance(entries: Array<{ debitCentavos: number; creditCentavos: number }>) {
  return entries.reduce(
    (balance, entry) =>
      subtractCentavos(addCentavos(balance, entry.debitCentavos), entry.creditCentavos),
    0
  );
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

async function selectReminderRecipients(studentId: string, db: DatabaseInstance) {
  const studentPortalEnabled =
    getServerEnv().ENABLE_STUDENT_PORTAL && (await isStudentPortalEnabled(db));
  if (studentPortalEnabled) return selectStudentRecipients(studentId, db);

  return db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.guardianStudents)
    .innerJoin(schema.guardians, eq(schema.guardians.id, schema.guardianStudents.guardianId))
    .innerJoin(schema.users, eq(schema.users.id, schema.guardians.userId))
    .where(eq(schema.guardianStudents.studentId, studentId));
}

async function selectAnnouncementRecipients(
  audience: (typeof schema.announcementAudienceEnum.enumValues)[number],
  db: DatabaseInstance
) {
  const roles: Array<(typeof schema.userRoleEnum.enumValues)[number]> =
    audience === 'PARENT'
      ? ['PARENT']
      : audience === 'STUDENT'
        ? ['STUDENT']
        : ['PARENT', 'STUDENT'];
  const studentPortalEnabled =
    getServerEnv().ENABLE_STUDENT_PORTAL && (await isStudentPortalEnabled(db));
  const eligibleRoles = studentPortalEnabled ? roles : roles.filter((role) => role !== 'STUDENT');
  if (eligibleRoles.length === 0) return [];

  return db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(and(eq(schema.users.active, true), inArray(schema.users.role, eligibleRoles)));
}

async function attemptDelivery(
  notification: NotificationRecord,
  delivery: DeliveryRecord,
  db: DatabaseInstance,
  provider: EmailProvider
) {
  const attemptedAt = new Date();
  const claim = await db.transaction(async (tx) => {
    const claimed = await tx
      .update(schema.notificationDeliveries)
      .set({
        status: 'RETRYING',
        attemptCount: sql`${schema.notificationDeliveries.attemptCount} + 1`,
        lastAttemptAt: attemptedAt,
        nextAttemptAt: null,
        updatedAt: attemptedAt,
      })
      .where(
        and(
          eq(schema.notificationDeliveries.id, delivery.id),
          inArray(schema.notificationDeliveries.status, ['PENDING', 'FAILED']),
          lt(schema.notificationDeliveries.attemptCount, MAX_DELIVERY_ATTEMPTS)
        )
      )
      .returning({
        id: schema.notificationDeliveries.id,
        attemptCount: schema.notificationDeliveries.attemptCount,
      });
    if (!claimed[0]) return null;

    const [attempt] = await tx
      .insert(schema.notificationDeliveryAttempts)
      .values({
        deliveryId: claimed[0].id,
        attemptNumber: claimed[0].attemptCount,
        status: 'RETRYING',
        attemptedAt,
      })
      .returning({ id: schema.notificationDeliveryAttempts.id });
    if (!attempt) throw new Error('The notification delivery attempt could not be persisted.');
    return {
      attemptId: attempt.id,
      attemptCount: claimed[0].attemptCount,
    };
  });
  if (!claim) return selectDelivery(notification.id, db);

  try {
    const recipient = notification.userId ? await selectRecipient(notification.userId, db) : null;
    if (!recipient?.email) throw new Error('The notification recipient has no email address.');

    const result = await provider.send({
      to: recipient.email,
      subject: notification.title,
      text: notification.body,
    });
    const sentAt = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(schema.notificationDeliveryAttempts)
        .set({
          status: 'SENT',
          providerMessageId: result.providerMessageId ?? null,
          completedAt: sentAt,
        })
        .where(eq(schema.notificationDeliveryAttempts.id, claim.attemptId));
      await tx
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notification delivery failed.';
    const status: NotificationStatus =
      claim.attemptCount >= MAX_DELIVERY_ATTEMPTS ? 'FAILED' : 'PENDING';
    const nextAttemptAt =
      status === 'PENDING'
        ? new Date(attemptedAt.getTime() + 2 ** claim.attemptCount * 60 * 1000)
        : null;
    await db.transaction(async (tx) => {
      await tx
        .update(schema.notificationDeliveryAttempts)
        .set({ status: 'FAILED', errorMessage: message, completedAt: new Date() })
        .where(eq(schema.notificationDeliveryAttempts.id, claim.attemptId));
      await tx
        .update(schema.notificationDeliveries)
        .set({ status, nextAttemptAt, errorMessage: message, updatedAt: new Date() })
        .where(eq(schema.notificationDeliveries.id, delivery.id));
    });
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

  if (
    delivery.status === 'PENDING' &&
    (!delivery.nextAttemptAt || delivery.nextAttemptAt <= new Date())
  ) {
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
      logSanitizedError('notification.persistence', error);
    }
  }
  return summary;
}

async function selectAssessmentContext(assessmentId: string, db: DatabaseInstance) {
  const rows = await db
    .select({
      id: schema.studentAssessments.id,
      studentId: schema.studentAssessments.studentId,
      status: schema.studentAssessments.status,
      dueDate: schema.studentAssessments.dueDate,
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

async function selectPaymentSubmissionContext(submissionId: string, db: DatabaseInstance) {
  const rows = await db
    .select({
      id: schema.paymentSubmissions.id,
      submittedByUserId: schema.paymentSubmissions.submittedByUserId,
      paymentChannel: schema.paymentSubmissions.paymentChannel,
      amountCentavos: schema.paymentSubmissions.amountCentavos,
      referenceNumber: schema.paymentSubmissions.referenceNumber,
      status: schema.paymentSubmissions.status,
      rejectionReason: schema.paymentSubmissions.rejectionReason,
      studentName: schema.students.firstName,
      studentLastName: schema.students.lastName,
    })
    .from(schema.paymentSubmissions)
    .innerJoin(schema.students, eq(schema.students.id, schema.paymentSubmissions.studentId))
    .where(eq(schema.paymentSubmissions.id, submissionId))
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
      logSanitizedError('notification.assessment_dispatch', error);
      return emptySummary();
    }
  }

  static async notifyPaymentDueReminder(
    assessmentId: string,
    input: { now?: Date } = {},
    db: DatabaseInstance = getDb(),
    provider: EmailProvider = getEmailProvider()
  ) {
    try {
      const assessment = await selectAssessmentContext(assessmentId, db);
      if (!assessment || assessment.status !== 'POSTED' || !assessment.dueDate) {
        return emptySummary();
      }

      const [ledgerEntries, settings] = await Promise.all([
        db
          .select({
            debitCentavos: schema.ledgerEntries.debitCentavos,
            creditCentavos: schema.ledgerEntries.creditCentavos,
          })
          .from(schema.ledgerEntries)
          .where(eq(schema.ledgerEntries.assessmentId, assessmentId)),
        getOrCreateSchoolSettings(db),
      ]);
      const balanceCentavos = calculateLedgerBalance(ledgerEntries);
      const deadline = evaluateDeadline({
        balanceCentavos,
        dueDate: assessment.dueDate,
        reminderLeadDays: settings.reminderLeadDays,
        today: getManilaDateString(input.now),
      });
      if (deadline.deadlineState !== 'DUE_SOON') return emptySummary();

      const recipients = await selectReminderRecipients(assessment.studentId, db);
      const studentName = `${assessment.studentName} ${assessment.studentLastName}`;
      const daysRemaining = deadline.daysFromDueDate ?? 0;
      return dispatchToRecipients(
        recipients,
        {
          type: 'PAYMENT_DUE_REMINDER',
          dedupeKey: `payment-due:${assessment.id}:${assessment.dueDate}`,
          entityType: 'ASSESSMENT',
          entityId: assessment.id,
          title: `Payment due soon for ${studentName}`,
          body: `${assessment.assessmentPeriod} assessment ${assessment.feeStructureName} has ${formatCentavos(balanceCentavos)} remaining. Due date: ${assessment.dueDate} (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining).`,
        },
        db,
        provider
      );
    } catch (error) {
      logSanitizedError('notification.payment_due_reminder_dispatch', error);
      return emptySummary();
    }
  }

  static async notifyAnnouncementPublished(
    announcementId: string,
    db: DatabaseInstance = getDb(),
    provider: EmailProvider = getEmailProvider()
  ) {
    try {
      const rows = await db
        .select()
        .from(schema.announcements)
        .where(eq(schema.announcements.id, announcementId))
        .limit(1);
      const announcement = rows[0];
      if (!announcement || announcement.status !== 'PUBLISHED') return emptySummary();

      const recipients = await selectAnnouncementRecipients(announcement.audience, db);
      return dispatchToRecipients(
        recipients,
        {
          type: 'ANNOUNCEMENT',
          dedupeKey: `announcement-published:${announcement.id}`,
          entityType: 'ANNOUNCEMENT',
          entityId: announcement.id,
          title: announcement.title,
          body: announcement.body,
        },
        db,
        provider
      );
    } catch (error) {
      logSanitizedError('notification.announcement_dispatch', error);
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
          title: 'System-generated payment receipt available',
          body: `System-generated payment receipt ${payment.receiptNumber ?? payment.receiptId} is available for ${studentName}.`,
        },
        db,
        provider
      );
      return combineSummaries(paymentSummary, receiptSummary);
    } catch (error) {
      logSanitizedError('notification.payment_dispatch', error);
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
      logSanitizedError('notification.payment_reversal_dispatch', error);
      return emptySummary();
    }
  }

  static async notifyPaymentProofSubmitted(
    submissionId: string,
    db: DatabaseInstance = getDb(),
    provider: EmailProvider = getEmailProvider()
  ) {
    try {
      const submission = await selectPaymentSubmissionContext(submissionId, db);
      if (!submission || submission.status !== 'PENDING_VERIFICATION') return emptySummary();
      const recipient = await selectRecipient(submission.submittedByUserId, db);
      if (!recipient) return emptySummary();
      const studentName = `${submission.studentName} ${submission.studentLastName}`;
      return dispatchToRecipients(
        [recipient],
        {
          type: 'PAYMENT_PROOF_SUBMITTED',
          dedupeKey: `payment-proof-submitted:${submission.id}`,
          entityType: 'PAYMENT_SUBMISSION',
          entityId: submission.id,
          title: 'Payment proof submitted for review',
          body: `Your ${submission.paymentChannel} payment proof for ${studentName} (${formatCentavos(submission.amountCentavos)}) is pending school verification.`,
        },
        db,
        provider
      );
    } catch (error) {
      logSanitizedError('notification.payment_proof_submission_dispatch', error);
      return emptySummary();
    }
  }

  static async notifyPaymentProofRejected(
    submissionId: string,
    db: DatabaseInstance = getDb(),
    provider: EmailProvider = getEmailProvider()
  ) {
    try {
      const submission = await selectPaymentSubmissionContext(submissionId, db);
      if (!submission || submission.status !== 'REJECTED') return emptySummary();
      const recipient = await selectRecipient(submission.submittedByUserId, db);
      if (!recipient) return emptySummary();
      const studentName = `${submission.studentName} ${submission.studentLastName}`;
      return dispatchToRecipients(
        [recipient],
        {
          type: 'PAYMENT_PROOF_REJECTED',
          dedupeKey: `payment-proof-rejected:${submission.id}`,
          entityType: 'PAYMENT_SUBMISSION',
          entityId: submission.id,
          title: 'Payment proof needs attention',
          body: `Your ${submission.paymentChannel} payment proof for ${studentName} was rejected. Reason: ${submission.rejectionReason ?? 'The school requested a correction.'}`,
        },
        db,
        provider
      );
    } catch (error) {
      logSanitizedError('notification.payment_proof_rejection_dispatch', error);
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

    if (
      delivery.status === 'RETRYING' ||
      (delivery.status === 'FAILED' && delivery.attemptCount >= MAX_DELIVERY_ATTEMPTS)
    ) {
      return delivery;
    }
    return attemptDelivery(notification, delivery, db, provider);
  }
}
