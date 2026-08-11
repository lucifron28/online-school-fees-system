import { z } from 'zod/v3';

export const announcementAudienceSchema = z.enum(['PARENT', 'STUDENT', 'PARENT_AND_STUDENT']);
export const announcementStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);

const announcementDateSchema = z.coerce
  .date()
  .refine((value: Date) => !Number.isNaN(value.getTime()), {
    message: 'A valid date and time is required.',
  });

const announcementShape = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(4000),
  audience: announcementAudienceSchema,
  status: announcementStatusSchema.default('DRAFT'),
  publishAt: announcementDateSchema,
  expiresAt: announcementDateSchema.nullable().optional(),
});

export const announcementCreateInputSchema = announcementShape.superRefine((value, context) => {
  if (value.expiresAt && value.expiresAt <= value.publishAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expiresAt'],
      message: 'The expiry must be after the publish date.',
    });
  }
  if (value.status === 'ARCHIVED') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'New announcements cannot start archived.',
    });
  }
});

export const announcementUpdateInputSchema = announcementShape
  .partial()
  .superRefine((value, context) => {
    if (value.expiresAt && value.publishAt && value.expiresAt <= value.publishAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresAt'],
        message: 'The expiry must be after the publish date.',
      });
    }
  });

export type AnnouncementAudience = z.infer<typeof announcementAudienceSchema>;
export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>;
export type AnnouncementCreateInput = z.infer<typeof announcementCreateInputSchema>;
export type AnnouncementUpdateInput = z.infer<typeof announcementUpdateInputSchema>;
