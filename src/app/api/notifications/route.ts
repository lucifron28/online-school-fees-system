import { NextResponse } from 'next/server';
import { notificationListInputSchema } from '@/lib/notifications';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { NotificationService } from '@/server/services/notification.service';

export async function GET(request: Request) {
  try {
    const user = await requireRequestAuth(request);
    const params = new URL(request.url).searchParams;
    const { limit } = notificationListInputSchema.parse({
      limit: params.get('limit') ?? undefined,
    });
    const auditScope = params.get('scope') === 'all';
    if (auditScope && !['ADMIN', 'FINANCE_STAFF'].includes(user.role)) {
      throw new Error('FORBIDDEN');
    }
    return NextResponse.json(
      await NotificationService.getHistory({ userId: auditScope ? undefined : user.id, limit })
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
