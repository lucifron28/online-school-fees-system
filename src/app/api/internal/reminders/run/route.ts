import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { logSanitizedError } from '@/server/logging';
import { publishDueAnnouncements } from '@/server/services/announcement.service';
import { ReminderService } from '@/server/services/reminder.service';

function getProvidedSecret(request: Request) {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length);
  return request.headers.get('x-cron-secret');
}

export async function POST(request: Request) {
  const configuredSecret = getServerEnv().CRON_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }
  if (getProvidedSecret(request) !== configuredSecret) {
    return NextResponse.json({ error: 'Invalid cron credentials.' }, { status: 401 });
  }

  try {
    const announcements = await publishDueAnnouncements();
    const reminders = await ReminderService.runDueReminders();
    return NextResponse.json({ announcements, reminders });
  } catch (error) {
    logSanitizedError('internal.reminder_processor', error);
    return NextResponse.json({ error: 'The reminder processor failed.' }, { status: 500 });
  }
}
