import { NextResponse } from 'next/server';
import type { AnnouncementUpdateInput } from '@/lib/announcements';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import {
  archiveAnnouncement,
  getAnnouncement,
  updateAnnouncement,
} from '@/server/services/announcement.service';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await context.params;
    return NextResponse.json(await getAnnouncement(id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await context.params;
    return NextResponse.json(
      await updateAnnouncement(id, await readJson<AnnouncementUpdateInput>(request), user.id)
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await context.params;
    return NextResponse.json(await archiveAnnouncement(id, user.id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
