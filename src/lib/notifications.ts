import { z } from 'zod/v3';

export const notificationTypeSchema = z.enum([
  'ASSESSMENT_POSTED',
  'PAYMENT_SUCCESSFUL',
  'RECEIPT_AVAILABLE',
  'PAYMENT_REVERSED',
  'DUE_REMINDER',
  'PAYMENT_DUE_REMINDER',
  'ANNOUNCEMENT',
]);

export const notificationListInputSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
