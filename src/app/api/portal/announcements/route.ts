import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { listVisibleAnnouncements } from '@/server/services/announcement.service';

export async function GET(request: Request) {
  try {
    const user = await requireRequestAuth(request, ['PARENT', 'STUDENT']);
    return NextResponse.json(
      await listVisibleAnnouncements({ audience: user.role === 'STUDENT' ? 'STUDENT' : 'PARENT' })
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
