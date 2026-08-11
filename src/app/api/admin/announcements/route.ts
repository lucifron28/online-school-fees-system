import { NextResponse } from 'next/server';
import type { AnnouncementCreateInput } from '@/lib/announcements';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { createAnnouncement, listAnnouncements } from '@/server/services/announcement.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    return NextResponse.json(await listAnnouncements({ includeArchived: true }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const input = await readJson<AnnouncementCreateInput>(request);
    return NextResponse.json(await createAnnouncement(input, user.id), { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
