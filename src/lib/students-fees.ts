import { z } from 'zod/v3';

export const studentStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'WITHDRAWN', 'GRADUATED']);
export const assessmentPeriodSchema = z.enum(['ANNUAL', 'SEMESTER', 'TRIMESTER', 'MONTHLY']);
export const feeStructureStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
export const feeCategoryStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);

const optionalUuid = z.string().uuid().nullable();
const optionalUserId = z.string().trim().min(1).max(120).nullable();

const studentFieldsSchema = z.object({
  studentNumber: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers, or hyphens for the student number.')
    .transform((value) => value.toUpperCase()),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z
    .string()
    .trim()
    .email()
    .max(160)
    .transform((value) => value.toLowerCase()),
  userId: optionalUserId,
  gradeLevelId: optionalUuid,
  sectionId: optionalUuid,
  schoolYearId: optionalUuid,
  status: studentStatusSchema,
});

export const studentCreateInputSchema = studentFieldsSchema;
export const studentUpdateInputSchema = studentFieldsSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide at least one student field to update.'
  );

export const studentListInputSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: studentStatusSchema.optional(),
  gradeLevelId: z.string().uuid().optional(),
  schoolYearId: z.string().uuid().optional(),
  sort: z.enum(['studentNumber', 'lastName', 'firstName', 'status']).default('lastName'),
  direction: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const guardianFieldsSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z
    .string()
    .trim()
    .email()
    .max(160)
    .transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(3).max(40),
  relationship: z.string().trim().min(1).max(60),
  address: z.string().trim().min(1).max(240),
  userId: optionalUserId,
});

export const guardianCreateInputSchema = guardianFieldsSchema;
export const guardianUpdateInputSchema = guardianFieldsSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide at least one guardian field to update.'
  );

export const guardianListInputSchema = z.object({
  search: z.string().trim().max(120).optional(),
  studentId: z.string().uuid().optional(),
});

export const guardianStudentLinkInputSchema = z.object({
  guardianId: z.string().uuid(),
  studentId: z.string().uuid(),
  isPrimary: z.boolean().default(false),
});

export const feeCategoryCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers, or hyphens for the category code.')
    .transform((value) => value.toUpperCase()),
  description: z
    .string()
    .trim()
    .max(240)
    .transform((value) => value || null)
    .nullable(),
  status: feeCategoryStatusSchema,
});

export const feeCategoryUpdateInputSchema = feeCategoryCreateInputSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide at least one fee-category field to update.'
  );

export const feeStructureItemInputSchema = z.object({
  feeCategoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  amountCentavos: z.number().int().positive().max(2_147_483_647),
});

export const feeStructureCreateInputSchema = z.object({
  schoolYearId: z.string().uuid(),
  gradeLevelId: z.string().uuid(),
  assessmentPeriod: assessmentPeriodSchema,
  name: z.string().trim().min(1).max(120),
  status: feeStructureStatusSchema,
  items: z.array(feeStructureItemInputSchema).min(1, 'Add at least one fee item.'),
});

export const feeStructureUpdateInputSchema = z
  .object({
    schoolYearId: z.string().uuid().optional(),
    gradeLevelId: z.string().uuid().optional(),
    assessmentPeriod: assessmentPeriodSchema.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    status: feeStructureStatusSchema.optional(),
    items: z.array(feeStructureItemInputSchema).min(1).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide at least one fee-structure field to update.'
  );

export const feeStructureItemUpdateInputSchema = feeStructureItemInputSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide at least one fee-item field to update.'
  );

export const feeStructureListInputSchema = z.object({
  schoolYearId: z.string().uuid().optional(),
  gradeLevelId: z.string().uuid().optional(),
  status: feeStructureStatusSchema.optional(),
});

export type StudentCreateInput = z.infer<typeof studentCreateInputSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateInputSchema>;
export type StudentListInput = z.infer<typeof studentListInputSchema>;
export type GuardianCreateInput = z.infer<typeof guardianCreateInputSchema>;
export type GuardianUpdateInput = z.infer<typeof guardianUpdateInputSchema>;
export type GuardianListInput = z.infer<typeof guardianListInputSchema>;
export type GuardianStudentLinkInput = z.infer<typeof guardianStudentLinkInputSchema>;
export type FeeCategoryCreateInput = z.infer<typeof feeCategoryCreateInputSchema>;
export type FeeCategoryUpdateInput = z.infer<typeof feeCategoryUpdateInputSchema>;
export type FeeStructureCreateInput = z.infer<typeof feeStructureCreateInputSchema>;
export type FeeStructureUpdateInput = z.infer<typeof feeStructureUpdateInputSchema>;
export type FeeStructureItemInput = z.infer<typeof feeStructureItemInputSchema>;
export type FeeStructureItemUpdateInput = z.infer<typeof feeStructureItemUpdateInputSchema>;
export type FeeStructureListInput = z.infer<typeof feeStructureListInputSchema>;
