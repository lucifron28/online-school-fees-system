import { afterEach, describe, expect, it } from 'vitest';
import {
  ConsoleEmailProvider,
  getEmailProvider,
  ResendEmailProvider,
} from '@/server/services/notification.service';
import { notificationListInputSchema, notificationTypeSchema } from '@/lib/notifications';

const originalResendKey = process.env.RESEND_API_KEY;
const originalEmailFrom = process.env.EMAIL_FROM;

afterEach(() => {
  if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalResendKey;
  if (originalEmailFrom === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = originalEmailFrom;
});

describe('Notifications', () => {
  it('uses the console provider when Resend is not configured', () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;

    const provider = getEmailProvider();

    expect(provider).toBeInstanceOf(ConsoleEmailProvider);
    expect(provider.channel).toBe('CONSOLE');
  });

  it('selects Resend only when both required settings are present', () => {
    process.env.RESEND_API_KEY = 're_phase_nine_test_key';
    process.env.EMAIL_FROM = 'notifications@example.com';

    const provider = getEmailProvider();

    expect(provider).toBeInstanceOf(ResendEmailProvider);
    expect(provider.channel).toBe('EMAIL');
  });

  it('validates notification history limits and event types', () => {
    expect(notificationListInputSchema.parse({}).limit).toBe(50);
    expect(notificationListInputSchema.parse({ limit: '25' }).limit).toBe(25);
    expect(notificationTypeSchema.parse('RECEIPT_AVAILABLE')).toBe('RECEIPT_AVAILABLE');
    expect(() => notificationListInputSchema.parse({ limit: 101 })).toThrow();
  });
});
