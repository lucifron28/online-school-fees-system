import { NextResponse } from 'next/server';
import { paymentSubmissionListInputSchema } from '@/lib/payment-submissions';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { listPaymentSubmissions } from '@/server/services/payment-submission.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const url = new URL(request.url);
    const input = paymentSubmissionListInputSchema.parse(Object.fromEntries(url.searchParams));
    return NextResponse.json(await listPaymentSubmissions(input));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
