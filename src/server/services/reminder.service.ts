import { getDb, type DatabaseInstance } from '@/db';
import {
  getEmailProvider,
  NotificationService,
  type EmailProvider,
  type NotificationDispatchSummary,
} from '@/server/services/notification.service';
import { listAssessmentDeadlineMonitor } from '@/server/services/deadline.service';
import { publishDueAnnouncements } from '@/server/services/announcement.service';

export interface ReminderRunResult extends NotificationDispatchSummary {
  assessed: number;
  eligible: number;
}

function emptySummary(): ReminderRunResult {
  return {
    assessed: 0,
    eligible: 0,
    attempted: 0,
    created: 0,
    deduplicated: 0,
    sent: 0,
    retrying: 0,
    failed: 0,
  };
}

function addSummary(target: ReminderRunResult, summary: NotificationDispatchSummary) {
  target.attempted += summary.attempted;
  target.created += summary.created;
  target.deduplicated += summary.deduplicated;
  target.sent += summary.sent;
  target.retrying += summary.retrying;
  target.failed += summary.failed;
}

export class ReminderService {
  static async runDueReminders(
    input: { now?: Date; batchSize?: number } = {},
    db: DatabaseInstance = getDb(),
    provider: EmailProvider = getEmailProvider()
  ): Promise<ReminderRunResult> {
    const result = emptySummary();
    const batchSize = Math.min(100, Math.max(1, input.batchSize ?? 50));
    let offset = 0;

    while (true) {
      const candidates = await listAssessmentDeadlineMonitor(
        { now: input.now, limit: batchSize, offset },
        db
      );
      if (candidates.length === 0) break;

      result.assessed += candidates.length;

      for (const candidate of candidates) {
        if (candidate.deadlineState !== 'DUE_SOON') continue;
        result.eligible += 1;
        const summary = await NotificationService.notifyPaymentDueReminder(
          candidate.assessmentId,
          { now: input.now },
          db,
          provider
        );
        addSummary(result, summary);
      }

      if (candidates.length < batchSize) break;
      offset += candidates.length;
    }

    return result;
  }

  static async runScheduledProcessing(
    input: { now?: Date } = {},
    db: DatabaseInstance = getDb(),
    provider: EmailProvider = getEmailProvider()
  ) {
    const announcements = await publishDueAnnouncements({ now: input.now }, db, provider);
    const reminders = await ReminderService.runDueReminders(input, db, provider);
    const retries = await NotificationService.processDueNotificationRetries(input, db, provider);
    return { announcements, reminders, retries };
  }
}
