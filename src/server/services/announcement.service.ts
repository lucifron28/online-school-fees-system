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
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors';

type AnnouncementRecord = typeof schema.announcements.$inferSelect;

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
  if (values.status === 'PUBLISHED') {
    throw new ValidationError(
      'New announcements must be published through the explicit publish action.'
    );
  }
  void provider;
  const [created] = await db
    .insert(schema.announcements)
    .values({
      title: values.title,
      body: values.body,
      audience: values.audience,
      status: values.status,
      publishAt: values.publishAt,
      expiresAt: values.expiresAt ?? null,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    })
    .returning();
  if (!created) throw new ValidationError('The announcement could not be created.');
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
  if (current.status === 'ARCHIVED') {
    throw new ValidationError('Archived announcements cannot be edited.');
  }
  const values = announcementUpdateInputSchema.parse(input);
  const nextTitle = values.title ?? current.title;
  const nextBody = values.body ?? current.body;
  const nextAudience = values.audience ?? current.audience;
  const nextPublishAt = values.publishAt ?? current.publishAt;
  const nextExpiresAt = values.expiresAt === undefined ? current.expiresAt : values.expiresAt;
  if (nextExpiresAt && nextExpiresAt <= nextPublishAt) {
    throw new ValidationError('The expiry must be after the publish date.');
  }
  if (current.status === 'PUBLISHED') {
    if (values.status && values.status !== 'PUBLISHED') {
      throw new ValidationError('Published announcements cannot be unpublished through edit.');
    }
    if (values.publishAt && values.publishAt.getTime() !== current.publishAt.getTime()) {
      throw new ValidationError(
        'Published announcement publish time cannot be changed; archive it and create a replacement.'
      );
    }
  } else if (values.status === 'PUBLISHED' || values.status === 'ARCHIVED') {
    throw new ValidationError('Use the explicit publish or archive action for lifecycle changes.');
  }
  const status = current.status === 'PUBLISHED' ? 'PUBLISHED' : (values.status ?? current.status);
  const updatedAt = new Date();

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
      updatedAt,
    })
    .where(and(eq(schema.announcements.id, id), eq(schema.announcements.status, current.status)))
    .returning();
  if (!updated) {
    const latest = await getAnnouncement(id, db);
    if (latest.status === 'ARCHIVED') {
      throw new ValidationError('Archived announcements cannot be edited.');
    }
    throw new ConflictError('The announcement changed while it was being edited.');
  }
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
  if (current.status === 'PUBLISHED') return current;
  if (current.expiresAt && current.expiresAt <= new Date()) {
    throw new ValidationError('Expired announcements cannot be published.');
  }
  const now = new Date();
  const [published] = await db
    .update(schema.announcements)
    .set({
      status: 'PUBLISHED',
      publishAt: now,
      updatedByUserId: actorUserId,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.announcements.id, id),
        inArray(schema.announcements.status, ['DRAFT', 'SCHEDULED'])
      )
    )
    .returning();
  if (!published) {
    const latest = await getAnnouncement(id, db);
    if (latest.status === 'PUBLISHED') return latest;
    if (latest.status === 'ARCHIVED') {
      throw new ValidationError('Archived announcements cannot be published.');
    }
    throw new ConflictError('The announcement changed while it was being published.');
  }
  await dispatchIfPublished(published, db, provider);
  return published;
}

export async function archiveAnnouncement(
  id: string,
  actorUserId: string,
  db: DatabaseInstance = getDb()
) {
  const current = await getAnnouncement(id, db);
  if (current.status === 'ARCHIVED') return current;
  const updatedAt = new Date();
  const [archived] = await db
    .update(schema.announcements)
    .set({ status: 'ARCHIVED', updatedByUserId: actorUserId, updatedAt })
    .where(and(eq(schema.announcements.id, id), eq(schema.announcements.status, current.status)))
    .returning();
  if (!archived) {
    const latest = await getAnnouncement(id, db);
    if (latest.status === 'ARCHIVED') return latest;
    throw new ConflictError('The announcement changed while it was being archived.');
  }
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
        eq(schema.announcements.status, 'PUBLISHED'),
        lte(schema.announcements.publishAt, now),
        or(isNull(schema.announcements.expiresAt), gt(schema.announcements.expiresAt, now))
      )
    )
    .orderBy(asc(schema.announcements.publishAt));
}
