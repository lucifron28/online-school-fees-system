import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { NotificationService } from '@/server/services/notification.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    return NextResponse.json(await NotificationService.retryNotification(id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
