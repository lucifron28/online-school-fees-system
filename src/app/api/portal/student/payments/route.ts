import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { listOwnedPayments } from '@/server/services/portal.service';

export async function GET(request: Request) {
  try {
    const actor = await requireRequestAuth(request, ['STUDENT']);
    return NextResponse.json(await listOwnedPayments(actor.id, 'STUDENT'));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
