import dotenv from 'dotenv';
import path from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../index';
import * as schema from '../schema';
import { evaluateDeadline } from '../../lib/deadlines';
import {
  createAnnouncement,
  listVisibleAnnouncements,
} from '../../server/services/announcement.service';
import {
  ConsoleEmailProvider,
  NotificationService,
} from '../../server/services/notification.service';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for deadline and announcement verification.');
  }
  const db = getDb(process.env.DATABASE_URL);
  const provider = new ConsoleEmailProvider();
  const suffix = Date.now();
  const announcementIds: string[] = [];
  try {
    const [admin] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.email, 'admin@demo.school'), eq(schema.users.role, 'ADMIN')))
      .limit(1);
    assert(admin, 'The demo admin is required.');

    const settings = await db
      .select({
        defaultPaymentTermDays: schema.schoolSettings.defaultPaymentTermDays,
        reminderLeadDays: schema.schoolSettings.reminderLeadDays,
      })
      .from(schema.schoolSettings)
      .where(eq(schema.schoolSettings.singletonKey, 'default'))
      .limit(1);
    assert(
      settings[0] &&
        settings[0].defaultPaymentTermDays >= 1 &&
        settings[0].defaultPaymentTermDays <= 365,
      'Default payment-term settings are outside the database contract.'
    );
    assert(
      settings[0].reminderLeadDays >= 0 && settings[0].reminderLeadDays <= 30,
      'Reminder lead settings are outside the database contract.'
    );

    const paid = evaluateDeadline({
      balanceCentavos: 0,
      dueDate: '2026-08-01',
      reminderLeadDays: settings[0].reminderLeadDays,
      today: '2026-08-11',
    });
    const overdue = evaluateDeadline({
      balanceCentavos: 100,
      dueDate: '2026-08-01',
      reminderLeadDays: settings[0].reminderLeadDays,
      today: '2026-08-11',
    });
    assert(
      paid.deadlineState === 'PAID' && paid.paymentStatus === 'PAID',
      'PAID deadline state failed.'
    );
    assert(overdue.deadlineState === 'OVERDUE', 'OVERDUE deadline state failed.');

    const published = await createAnnouncement(
      {
        title: `Deadline verification ${suffix}`,
        body: 'Persisted payment announcement verification.',
        audience: 'PARENT',
        status: 'PUBLISHED',
        publishAt: new Date(),
      },
      admin.id,
      db,
      provider
    );
    announcementIds.push(published.id);
    const visible = await listVisibleAnnouncements({ audience: 'PARENT' }, db);
    assert(
      visible.some((announcement) => announcement.id === published.id),
      'Published announcement is not visible.'
    );
    const notificationRows = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.entityId, published.id),
          eq(schema.notifications.type, 'ANNOUNCEMENT')
        )
      );
    assert(notificationRows.length > 0, 'Announcement publication did not create notifications.');
    await NotificationService.notifyAnnouncementPublished(published.id, db, provider);
    const afterReplay = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.entityId, published.id),
          eq(schema.notifications.type, 'ANNOUNCEMENT')
        )
      );
    assert(
      afterReplay.length === notificationRows.length,
      'Announcement notification dedupe failed.'
    );

    const draft = await createAnnouncement(
      {
        title: `Draft verification ${suffix}`,
        body: 'This draft must remain hidden.',
        audience: 'PARENT',
        status: 'DRAFT',
        publishAt: new Date(),
      },
      admin.id,
      db,
      provider
    );
    announcementIds.push(draft.id);
    const visibleAfterDraft = await listVisibleAnnouncements({ audience: 'PARENT' }, db);
    assert(
      !visibleAfterDraft.some((announcement) => announcement.id === draft.id),
      'Draft announcement leaked into portal visibility.'
    );
    console.log(
      'Deadlines and announcements contract verified: settings bounds, derived states, persisted publication, portal visibility, and notification dedupe.'
    );
  } finally {
    if (announcementIds.length > 0) {
      const notificationRows = await db
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(inArray(schema.notifications.entityId, announcementIds));
      if (notificationRows.length > 0) {
        const notificationIds = notificationRows.map((row) => row.id);
        await db
          .delete(schema.notificationDeliveries)
          .where(inArray(schema.notificationDeliveries.notificationId, notificationIds));
        await db
          .delete(schema.notifications)
          .where(inArray(schema.notifications.id, notificationIds));
      }
      await db
        .delete(schema.announcements)
        .where(inArray(schema.announcements.id, announcementIds));
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
