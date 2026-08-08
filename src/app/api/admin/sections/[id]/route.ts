import { NextResponse } from 'next/server';
import type { SectionInput } from '@/lib/administration';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { updateSection } from '@/server/services/administration.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    const { id } = await params;
    return NextResponse.json(await updateSection(id, await readJson<SectionInput>(request)));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
