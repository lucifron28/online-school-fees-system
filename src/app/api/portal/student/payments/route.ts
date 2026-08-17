import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { listOwnedPaymentsPage } from '@/server/services/portal.service';

export async function GET(request: Request) {
  try {
    const actor = await requireRequestAuth(request, ['STUDENT']);
    const params = new URL(request.url).searchParams;
    return NextResponse.json(
      await listOwnedPaymentsPage(actor.id, 'STUDENT', {
        page: params.get('page') ? Number(params.get('page')) : undefined,
        pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : undefined,
      })
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
