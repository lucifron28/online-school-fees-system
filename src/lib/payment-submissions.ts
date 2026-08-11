import { z } from 'zod/v3';

export const paymentSubmissionChannelSchema = z.enum(['GCASH', 'MAYA']);
export const paymentSubmissionStatusSchema = z.enum([
  'PENDING_VERIFICATION',
  'APPROVED',
  'REJECTED',
]);

export const paymentSubmissionCreateInputSchema = z.object({
  studentId: z.string().uuid(),
  paymentChannel: paymentSubmissionChannelSchema,
  amountCentavos: z.number().int().positive().max(2_147_483_647),
  referenceNumber: z.string().trim().min(1).max(120),
  paidAt: z.string().datetime({ offset: true }),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const paymentSubmissionRejectInputSchema = z.object({
  reason: z.string().trim().min(1).max(240),
});

export const paymentSubmissionListInputSchema = z.object({
  status: paymentSubmissionStatusSchema.optional(),
  paymentChannel: paymentSubmissionChannelSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type PaymentSubmissionChannel = z.infer<typeof paymentSubmissionChannelSchema>;
export type PaymentSubmissionStatus = z.infer<typeof paymentSubmissionStatusSchema>;
export type PaymentSubmissionCreateInput = z.infer<typeof paymentSubmissionCreateInputSchema>;
export type PaymentSubmissionListInput = z.infer<typeof paymentSubmissionListInputSchema>;

export function normalizePaymentReference(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
