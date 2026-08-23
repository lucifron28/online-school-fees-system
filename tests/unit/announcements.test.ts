import { describe, expect, it } from 'vitest';
import {
  announcementCreateInputSchema,
  announcementListInputSchema,
  announcementUpdateInputSchema,
} from '@/lib/announcements';

describe('Payment Announcements Schema and Pagination', () => {
  it('validates announcement list query parameters with sensible defaults', () => {
    const parsed = announcementListInputSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.status).toBeUndefined();
    expect(parsed.audience).toBeUndefined();
    expect(parsed.search).toBeUndefined();
  });

  it('accepts explicit pagination, status, audience, and search filters', () => {
    const parsed = announcementListInputSchema.parse({
      page: '2',
      pageSize: '50',
      status: 'PUBLISHED',
      audience: 'PARENT',
      search: 'Enrollment',
    });
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.status).toBe('PUBLISHED');
    expect(parsed.audience).toBe('PARENT');
    expect(parsed.search).toBe('Enrollment');
  });

  it('enforces maximum page size limit', () => {
    expect(() => announcementListInputSchema.parse({ pageSize: '150' })).toThrow();
    expect(() => announcementListInputSchema.parse({ page: '-1' })).toThrow();
  });

  it('validates announcement creation input', () => {
    const valid = announcementCreateInputSchema.parse({
      title: 'Payment Schedule',
      body: 'Second quarter payments are due.',
      audience: 'PARENT_AND_STUDENT',
      publishAt: '2026-08-01T08:00:00.000Z',
      expiresAt: '2026-08-15T08:00:00.000Z',
    });
    expect(valid.title).toBe('Payment Schedule');
    expect(valid.status).toBe('DRAFT');
  });

  it('rejects expiry on or before publish date', () => {
    expect(() =>
      announcementCreateInputSchema.parse({
        title: 'Payment Schedule',
        body: 'Second quarter payments are due.',
        audience: 'PARENT',
        publishAt: '2026-08-15T08:00:00.000Z',
        expiresAt: '2026-08-10T08:00:00.000Z',
      })
    ).toThrow(/expiry must be after the publish date/i);
  });

  it('rejects starting new announcements as archived', () => {
    expect(() =>
      announcementCreateInputSchema.parse({
        title: 'Payment Schedule',
        body: 'Second quarter payments are due.',
        audience: 'PARENT',
        status: 'ARCHIVED',
        publishAt: '2026-08-01T08:00:00.000Z',
      })
    ).toThrow(/cannot start archived/i);
  });

  it('validates partial updates', () => {
    const update = announcementUpdateInputSchema.parse({
      title: 'Updated Schedule',
    });
    expect(update.title).toBe('Updated Schedule');
  });
});
