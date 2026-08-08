import { z } from 'zod';

export const notificationTypeSchema = z.enum([
  'ASSESSMENT_POSTED',
  'PAYMENT_SUCCESSFUL',
  'RECEIPT_AVAILABLE',
  'PAYMENT_REVERSED',
  'DUE_REMINDER',
]);

export const notificationListInputSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
