import { z } from 'zod/v3';

export const mockPaymentChannelSchema = z.enum(['GCash', 'Maya', 'CreditCard']);
export const mockPaymentOutcomeSchema = z.enum(['SUCCESS', 'FAILED', 'CANCELLED', 'PENDING']);

export const portalCheckoutInputSchema = z.object({
  studentId: z.string().uuid(),
  amountCentavos: z.number().int().positive().max(2_147_483_647),
  paymentChannel: mockPaymentChannelSchema,
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const mockCallbackInputSchema = z.object({
  paymentReference: z.string().trim().min(1).max(160),
  eventId: z.string().trim().min(8).max(160),
  idempotencyKey: z.string().trim().min(8).max(160),
  status: mockPaymentOutcomeSchema.default('SUCCESS'),
});

export type PortalCheckoutInput = z.infer<typeof portalCheckoutInputSchema>;
export type MockCallbackInput = z.infer<typeof mockCallbackInputSchema>;
