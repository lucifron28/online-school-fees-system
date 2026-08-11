import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { approvePaymentSubmission } from '@/server/services/payment-submission.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    return NextResponse.json(await approvePaymentSubmission(id, actor.id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
