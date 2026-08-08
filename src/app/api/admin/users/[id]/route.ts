import { NextResponse } from 'next/server';
import type { UserUpdateInput } from '@/lib/administration';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { updateUser } from '@/server/services/administration.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestAuth(request, ['ADMIN']);
    const { id } = await params;
    return NextResponse.json(
      await updateUser(id, actor.id, await readJson<UserUpdateInput>(request))
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
