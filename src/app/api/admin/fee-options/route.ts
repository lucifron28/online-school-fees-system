import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { listFeeOptions } from '@/server/services/students-fees.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    return NextResponse.json(await listFeeOptions());
  } catch (error) {
    return routeErrorResponse(error);
  }
}
