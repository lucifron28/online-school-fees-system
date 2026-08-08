import { describe, expect, it } from 'vitest';
import {
  feeStructureCreateInputSchema,
  feeStructureUpdateInputSchema,
  guardianStudentLinkInputSchema,
  studentCreateInputSchema,
} from '@/lib/students-fees';

const ids = {
  student: '00000000-0000-4000-8000-000000000001',
  guardian: '00000000-0000-4000-8000-000000000002',
  schoolYear: '00000000-0000-4000-8000-000000000003',
  gradeLevel: '00000000-0000-4000-8000-000000000004',
  category: '00000000-0000-4000-8000-000000000005',
};

describe('students, guardians, and fee validation', () => {
  it('normalizes student numbers and emails before persistence', () => {
    const value = studentCreateInputSchema.parse({
      studentNumber: ' 2026-ab-01 ',
      firstName: 'Rina',
      lastName: 'Santos',
      email: 'RINA@EXAMPLE.COM',
      userId: null,
      gradeLevelId: null,
      sectionId: null,
      schoolYearId: null,
      status: 'ACTIVE',
    });

    expect(value.studentNumber).toBe('2026-AB-01');
    expect(value.email).toBe('rina@example.com');
  });

  it('requires positive fee items and at least one item in a structure', () => {
    expect(() =>
      feeStructureCreateInputSchema.parse({
        schoolYearId: ids.schoolYear,
        gradeLevelId: ids.gradeLevel,
        assessmentPeriod: 'ANNUAL',
        name: 'Annual fees',
        status: 'DRAFT',
        items: [],
      })
    ).toThrow();

    expect(() =>
      feeStructureCreateInputSchema.parse({
        schoolYearId: ids.schoolYear,
        gradeLevelId: ids.gradeLevel,
        assessmentPeriod: 'ANNUAL',
        name: 'Annual fees',
        status: 'DRAFT',
        items: [{ feeCategoryId: ids.category, name: 'Tuition', amountCentavos: 0 }],
      })
    ).toThrow();
  });

  it('rejects empty fee-structure updates', () => {
    expect(() => feeStructureUpdateInputSchema.parse({})).toThrow(
      'Provide at least one fee-structure field to update.'
    );
  });

  it('defaults a guardian link to non-primary when omitted', () => {
    expect(
      guardianStudentLinkInputSchema.parse({ guardianId: ids.guardian, studentId: ids.student })
    ).toEqual({ guardianId: ids.guardian, studentId: ids.student, isPrimary: false });
  });
});
