import { NextResponse } from 'next/server';
import { getCronAuthorizationFailure } from '@/lib/cron';
import { getServerEnv } from '@/lib/env';
import { logSanitizedError } from '@/server/logging';
import { ReminderService } from '@/server/services/reminder.service';

async function handleReminderRun(request: Request) {
  const authorizationFailure = getCronAuthorizationFailure(request, getServerEnv().CRON_SECRET);
  if (authorizationFailure) {
    return NextResponse.json(
      { error: authorizationFailure.message },
      { status: authorizationFailure.status }
    );
  }

  try {
    return NextResponse.json(await ReminderService.runScheduledProcessing());
  } catch (error) {
    logSanitizedError('internal.reminder_processor', error);
    return NextResponse.json({ error: 'The reminder processor failed.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleReminderRun(request);
}

export async function POST(request: Request) {
  return handleReminderRun(request);
}
