import { NextResponse } from 'next/server';
import type { GradeLevelInput } from '@/lib/administration';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { updateGradeLevel } from '@/server/services/administration.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    const { id } = await params;
    return NextResponse.json(await updateGradeLevel(id, await readJson<GradeLevelInput>(request)));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
