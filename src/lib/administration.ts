import { z } from 'zod/v3';
import { USER_ROLES, type UserRole } from '@/lib/auth/roles';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const dateOnly = z
  .string()
  .regex(dateOnlyPattern, 'Use the YYYY-MM-DD date format.')
  .refine((value) => {
    const parts = value.split('-').map(Number);
    const year = parts[0] ?? 0;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Enter a valid calendar date.');

export const administrationRoleSchema = z.enum(USER_ROLES);

export const schoolSettingsInputSchema = z
  .object({
    schoolName: z.string().trim().min(1).max(160),
    shortName: z.string().trim().min(1).max(32),
    address: z.string().trim().min(1).max(240),
    email: z.string().trim().email().max(160),
    phone: z.string().trim().min(3).max(40),
    receiptPrefix: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{2,12}$/, 'Use 2-12 letters or numbers for the receipt prefix.'),
    currencyCode: z.literal('PHP'),
    timezone: z.literal('Asia/Manila'),
    defaultPaymentTermDays: z.number().int().min(1).max(365),
    reminderLeadDays: z.number().int().min(0).max(30),
    gcashEnabled: z.boolean().default(false),
    gcashAccountName: z.string().trim().max(160).nullable().default(null),
    gcashAccountNumber: z.string().trim().max(80).nullable().default(null),
    mayaEnabled: z.boolean().default(false),
    mayaAccountName: z.string().trim().max(160).nullable().default(null),
    mayaAccountNumber: z.string().trim().max(80).nullable().default(null),
    studentPortalEnabled: z.boolean(),
    activeSchoolYearId: z.string().uuid().nullable(),
  })
  .superRefine((values, context) => {
    if (values.gcashEnabled && (!values.gcashAccountName || !values.gcashAccountNumber)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gcashAccountName'],
        message: 'GCash account name and number are required when GCash is enabled.',
      });
    }
    if (values.mayaEnabled && (!values.mayaAccountName || !values.mayaAccountNumber)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mayaAccountName'],
        message: 'Maya account name and number are required when Maya is enabled.',
      });
    }
  });

export const schoolYearInputSchema = z.object({
  name: z.string().trim().min(3).max(80),
  startDate: dateOnly,
  endDate: dateOnly,
});

export const gradeLevelInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers, or hyphens for the grade code.')
    .transform((value) => value.toUpperCase()),
  displayOrder: z.number().int().min(0).max(999),
});

export const sectionInputSchema = z.object({
  gradeLevelId: z.string().uuid(),
  schoolYearId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers, or hyphens for the section code.')
    .transform((value) => value.toUpperCase()),
});

export const userCreateInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .email()
    .max(160)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  role: administrationRoleSchema,
});

export const userUpdateInputSchema = z
  .object({
    role: administrationRoleSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.active !== undefined, {
    message: 'Provide a role or active status to update.',
  });

export type SchoolSettingsInput = z.infer<typeof schoolSettingsInputSchema>;
export type SchoolYearInput = z.infer<typeof schoolYearInputSchema>;
export type GradeLevelInput = z.infer<typeof gradeLevelInputSchema>;
export type SectionInput = z.infer<typeof sectionInputSchema>;
export type UserCreateInput = z.infer<typeof userCreateInputSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateInputSchema>;

export interface AdministrationUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export function dateOnlyToUtcDate(value: string): Date {
  const parts = value.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export function utcDateToDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
