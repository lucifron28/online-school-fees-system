import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { publishAnnouncement } from '@/server/services/announcement.service';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await context.params;
    return NextResponse.json(await publishAnnouncement(id, user.id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
