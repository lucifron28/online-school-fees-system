import { z } from 'zod/v3';

export const otcPaymentMethodSchema = z.enum(['CASH', 'BANK_DEPOSIT']);
export const paymentMethodSchema = z.enum(['CASH', 'BANK_DEPOSIT', 'GCASH', 'MAYA', 'MOCK_ONLINE']);
export const paymentStatusSchema = z.enum(['PENDING', 'POSTED', 'FAILED', 'CANCELLED', 'REVERSED']);

export const paymentPostInputSchema = z.object({
  studentId: z.string().uuid(),
  amountCentavos: z.number().int().positive().max(2_147_483_647),
  paymentMethod: paymentMethodSchema,
  referenceNumber: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || undefined),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const otcPaymentPostInputSchema = paymentPostInputSchema.extend({
  paymentMethod: otcPaymentMethodSchema,
});

export const paymentListInputSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: paymentStatusSchema.optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export const reversalPostInputSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().trim().min(1).max(240),
});

export type PaymentPostInput = z.infer<typeof paymentPostInputSchema>;
export type PaymentListInput = z.infer<typeof paymentListInputSchema>;
export type ReversalPostInput = z.infer<typeof reversalPostInputSchema>;
