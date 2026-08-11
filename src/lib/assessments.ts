import { z } from 'zod/v3';
import { reportDateSchema } from '@/lib/reports';

export const assessmentStatusSchema = z.enum(['DRAFT', 'POSTED', 'CANCELLED']);
export const adjustmentTypeSchema = z.enum(['DEBIT', 'CREDIT']);

const feeItemSnapshotSchema = z.object({
  feeCategoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  amountCentavos: z.number().int().positive().max(2_147_483_647),
});

export const assessmentGenerateInputSchema = z.object({
  studentId: z.string().uuid(),
  // Legacy callers may still send the selected school year. The structure is
  // authoritative, but a supplied value is checked against it below.
  schoolYearId: z.string().uuid().optional(),
  feeStructureId: z.string().uuid(),
  dueDate: reportDateSchema.optional(),
  // Kept only for backwards-compatible validation of callers that previously
  // supplied items. The service never trusts or persists these values.
  items: z.array(feeItemSnapshotSchema).optional(),
});

export const assessmentPostInputSchema = z.object({
  feeStructureId: z.string().uuid(),
  dueDate: reportDateSchema.optional(),
});

export const assessmentListInputSchema = z.object({
  status: assessmentStatusSchema.optional(),
});

export const adjustmentInputSchema = z.object({
  assessmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  type: adjustmentTypeSchema,
  amountCentavos: z.number().int().positive().max(2_147_483_647),
  reason: z.string().trim().min(1).max(240),
});

export const adjustmentPostInputSchema = adjustmentInputSchema.omit({
  assessmentId: true,
  studentId: true,
});

export type AssessmentGenerateInput = z.infer<typeof assessmentGenerateInputSchema> & {
  actorUserId?: string | null;
};
export type AssessmentPostInput = z.infer<typeof assessmentPostInputSchema>;
export type AssessmentListInput = z.infer<typeof assessmentListInputSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentInputSchema> & {
  actorUserId?: string | null;
};
export type AdjustmentPostInput = z.infer<typeof adjustmentPostInputSchema>;
