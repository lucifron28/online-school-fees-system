import { and, asc, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import {
  announcementCreateInputSchema,
  announcementUpdateInputSchema,
  type AnnouncementAudience,
  type AnnouncementCreateInput,
  type AnnouncementUpdateInput,
} from '@/lib/announcements';
import { isStudentPortalEnabled } from '@/server/services/administration.service';
import {
  getEmailProvider,
  NotificationService,
  type EmailProvider,
} from '@/server/services/notification.service';
import { NotFoundError, ValidationError } from '@/server/errors';

type AnnouncementRecord = typeof schema.announcements.$inferSelect;

function normalizeStatus(
  status: AnnouncementRecord['status'],
  publishAt: Date,
  now: Date
): AnnouncementRecord['status'] {
  if (status === 'SCHEDULED' && publishAt <= now) return 'PUBLISHED';
  if (status === 'PUBLISHED' && publishAt > now) return 'SCHEDULED';
  return status;
}

export async function getAnnouncement(id: string, db: DatabaseInstance = getDb()) {
  const rows = await db
    .select()
    .from(schema.announcements)
    .where(eq(schema.announcements.id, id))
    .limit(1);
  if (!rows[0]) throw new NotFoundError('The announcement does not exist.');
  return rows[0];
}

async function dispatchIfPublished(
  announcement: AnnouncementRecord,
  db: DatabaseInstance,
  provider: EmailProvider
) {
  if (announcement.status !== 'PUBLISHED') return null;
  return NotificationService.notifyAnnouncementPublished(announcement.id, db, provider);
}

export async function listAnnouncements(
  input: { includeArchived?: boolean } = {},
  db: DatabaseInstance = getDb()
) {
  const statuses = input.includeArchived
    ? (['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const)
    : (['DRAFT', 'SCHEDULED', 'PUBLISHED'] as const);
  return db
    .select()
    .from(schema.announcements)
    .where(inArray(schema.announcements.status, [...statuses]))
    .orderBy(asc(schema.announcements.publishAt), asc(schema.announcements.createdAt));
}

export async function createAnnouncement(
  input: AnnouncementCreateInput,
  actorUserId: string,
  db: DatabaseInstance = getDb(),
  provider: EmailProvider = getEmailProvider()
) {
  const values = announcementCreateInputSchema.parse(input);
  const now = new Date();
  const status = normalizeStatus(values.status, values.publishAt, now);
  const [created] = await db
    .insert(schema.announcements)
    .values({
      title: values.title,
      body: values.body,
      audience: values.audience,
      status,
      publishAt: values.publishAt,
      expiresAt: values.expiresAt ?? null,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    })
    .returning();
  if (!created) throw new ValidationError('The announcement could not be created.');
  await dispatchIfPublished(created, db, provider);
  return created;
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementUpdateInput,
  actorUserId: string,
  db: DatabaseInstance = getDb(),
  provider: EmailProvider = getEmailProvider()
) {
  const current = await getAnnouncement(id, db);
  const values = announcementUpdateInputSchema.parse(input);
  const nextTitle = values.title ?? current.title;
  const nextBody = values.body ?? current.body;
  const nextAudience = values.audience ?? current.audience;
  const nextPublishAt = values.publishAt ?? current.publishAt;
  const nextExpiresAt = values.expiresAt === undefined ? current.expiresAt : values.expiresAt;
  if (nextExpiresAt && nextExpiresAt <= nextPublishAt) {
    throw new ValidationError('The expiry must be after the publish date.');
  }
  const requestedStatus = values.status ?? current.status;
  const status = normalizeStatus(requestedStatus, nextPublishAt, new Date());

  const [updated] = await db
    .update(schema.announcements)
    .set({
      title: nextTitle,
      body: nextBody,
      audience: nextAudience,
      status,
      publishAt: nextPublishAt,
      expiresAt: nextExpiresAt,
      updatedByUserId: actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(schema.announcements.id, id))
    .returning();
  if (!updated) throw new NotFoundError('The announcement does not exist.');
  await dispatchIfPublished(updated, db, provider);
  return updated;
}

export async function publishAnnouncement(
  id: string,
  actorUserId: string,
  db: DatabaseInstance = getDb(),
  provider: EmailProvider = getEmailProvider()
) {
  const current = await getAnnouncement(id, db);
  if (current.status === 'ARCHIVED')
    throw new ValidationError('Archived announcements cannot be published.');
  if (current.expiresAt && current.expiresAt <= new Date()) {
    throw new ValidationError('Expired announcements cannot be published.');
  }
  const [published] = await db
    .update(schema.announcements)
    .set({
      status: 'PUBLISHED',
      publishAt: new Date(),
      updatedByUserId: actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(schema.announcements.id, id))
    .returning();
  if (!published) throw new NotFoundError('The announcement does not exist.');
  await dispatchIfPublished(published, db, provider);
  return published;
}

export async function archiveAnnouncement(
  id: string,
  actorUserId: string,
  db: DatabaseInstance = getDb()
) {
  await getAnnouncement(id, db);
  const [archived] = await db
    .update(schema.announcements)
    .set({ status: 'ARCHIVED', updatedByUserId: actorUserId, updatedAt: new Date() })
    .where(eq(schema.announcements.id, id))
    .returning();
  if (!archived) throw new NotFoundError('The announcement does not exist.');
  return archived;
}

export async function publishDueAnnouncements(
  input: { now?: Date } = {},
  db: DatabaseInstance = getDb(),
  provider: EmailProvider = getEmailProvider()
) {
  const now = input.now ?? new Date();
  const scheduled = await db
    .select()
    .from(schema.announcements)
    .where(
      and(eq(schema.announcements.status, 'SCHEDULED'), lte(schema.announcements.publishAt, now))
    )
    .orderBy(asc(schema.announcements.publishAt));
  let published = 0;
  let archived = 0;
  for (const announcement of scheduled) {
    if (announcement.expiresAt && announcement.expiresAt <= now) {
      const expired = await db
        .update(schema.announcements)
        .set({ status: 'ARCHIVED', updatedAt: now, updatedByUserId: announcement.updatedByUserId })
        .where(
          and(
            eq(schema.announcements.id, announcement.id),
            eq(schema.announcements.status, 'SCHEDULED')
          )
        )
        .returning();
      if (expired[0]) archived += 1;
      continue;
    }
    const updated = await db
      .update(schema.announcements)
      .set({ status: 'PUBLISHED', updatedAt: now, updatedByUserId: announcement.updatedByUserId })
      .where(
        and(
          eq(schema.announcements.id, announcement.id),
          eq(schema.announcements.status, 'SCHEDULED')
        )
      )
      .returning();
    if (!updated[0]) continue;
    published += 1;
    await dispatchIfPublished(updated[0], db, provider);
  }
  return { examined: scheduled.length, published, archived };
}

export async function listVisibleAnnouncements(
  input: { audience: Exclude<AnnouncementAudience, 'PARENT_AND_STUDENT'>; now?: Date },
  db: DatabaseInstance = getDb()
) {
  const now = input.now ?? new Date();
  await publishDueAnnouncements({ now }, db);
  const audiences =
    input.audience === 'PARENT'
      ? (['PARENT', 'PARENT_AND_STUDENT'] as const)
      : (['STUDENT', 'PARENT_AND_STUDENT'] as const);
  if (input.audience === 'STUDENT' && !(await isStudentPortalEnabled(db))) return [];

  return db
    .select()
    .from(schema.announcements)
    .where(
      and(
        inArray(schema.announcements.audience, [...audiences]),
        inArray(schema.announcements.status, ['PUBLISHED', 'SCHEDULED']),
        lte(schema.announcements.publishAt, now),
        or(isNull(schema.announcements.expiresAt), gt(schema.announcements.expiresAt, now))
      )
    )
    .orderBy(asc(schema.announcements.publishAt));
}
