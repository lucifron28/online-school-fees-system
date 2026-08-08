import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { getStudentAccountForUser } from '@/server/services/portal.service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestAuth(request, ['PARENT']);
    const { id } = await params;
    return NextResponse.json(await getStudentAccountForUser(actor.id, 'PARENT', id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
