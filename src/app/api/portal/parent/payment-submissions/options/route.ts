import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { getPaymentDestinationOptions } from '@/server/services/payment-submission.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['PARENT']);
    return NextResponse.json(await getPaymentDestinationOptions());
  } catch (error) {
    return routeErrorResponse(error);
  }
}
