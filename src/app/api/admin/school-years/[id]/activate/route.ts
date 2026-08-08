import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { activateSchoolYear } from '@/server/services/administration.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    const { id } = await params;
    return NextResponse.json(await activateSchoolYear(id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
