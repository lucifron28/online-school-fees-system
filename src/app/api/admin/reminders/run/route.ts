import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { ReminderService } from '@/server/services/reminder.service';

export async function POST(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    return NextResponse.json(await ReminderService.runDueReminders());
  } catch (error) {
    return routeErrorResponse(error);
  }
}
