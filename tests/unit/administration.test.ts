import { describe, expect, it } from 'vitest';
import {
  dateOnlyToUtcDate,
  gradeLevelInputSchema,
  schoolSettingsInputSchema,
  schoolYearInputSchema,
  sectionInputSchema,
  userCreateInputSchema,
  userUpdateInputSchema,
  utcDateToDateOnly,
} from '@/lib/administration';

describe('administration input contracts', () => {
  it('normalizes grade and section codes for stable uniqueness', () => {
    expect(gradeLevelInputSchema.parse({ name: 'Grade 7', code: 'g7', displayOrder: 1 }).code).toBe(
      'G7'
    );
    expect(
      sectionInputSchema.parse({
        gradeLevelId: '00000000-0000-0000-0000-000000000001',
        schoolYearId: '00000000-0000-0000-0000-000000000002',
        name: 'Section A',
        code: 'section-a',
      }).code
    ).toBe('SECTION-A');
  });

  it('rejects invalid date ranges and non-PHP settings', () => {
    expect(
      schoolYearInputSchema.safeParse({
        name: 'SY 2026-2027',
        startDate: '2026-02-30',
        endDate: '2027-03-31',
      }).success
    ).toBe(false);
    expect(
      schoolSettingsInputSchema.safeParse({
        schoolName: 'School',
        shortName: 'S',
        address: 'Address',
        email: 'school@example.com',
        phone: '+63 2 0000 0000',
        receiptPrefix: 'OSFS',
        currencyCode: 'USD',
        timezone: 'Asia/Manila',
        studentPortalEnabled: true,
        activeSchoolYearId: null,
      }).success
    ).toBe(false);
  });

  it('normalizes account emails and requires an explicit user update', () => {
    expect(
      userCreateInputSchema.parse({
        name: 'Maria Santos',
        email: 'MARIA@EXAMPLE.COM',
        password: 'password123',
        role: 'PARENT',
      }).email
    ).toBe('maria@example.com');
    expect(userUpdateInputSchema.safeParse({}).success).toBe(false);
    expect(userUpdateInputSchema.parse({ active: false })).toEqual({ active: false });
  });

  it('round-trips date-only values in UTC without timezone drift', () => {
    const date = dateOnlyToUtcDate('2026-06-01');
    expect(date.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(utcDateToDateOnly(date)).toBe('2026-06-01');
  });
});
