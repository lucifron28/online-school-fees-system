import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { listOwnedPaymentsPage } from '@/server/services/portal.service';

export async function GET(request: Request) {
  try {
    const actor = await requireRequestAuth(request, ['PARENT']);
    const params = new URL(request.url).searchParams;
    return NextResponse.json(
      await listOwnedPaymentsPage(actor.id, 'PARENT', {
        studentId: params.get('studentId') ?? undefined,
        page: params.get('page') ? Number(params.get('page')) : undefined,
        pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : undefined,
      })
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
