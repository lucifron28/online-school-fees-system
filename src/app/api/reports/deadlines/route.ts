import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { getDeadlineSummary } from '@/server/services/deadline.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    return NextResponse.json(await getDeadlineSummary({ limit: 1000 }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
