import { NextResponse } from 'next/server';
import type { ReversalPostInput } from '@/lib/payments';
import { reversalPostInputSchema } from '@/lib/payments';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { PaymentService } from '@/server/services/payment.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    const body = reversalPostInputSchema.parse({
      paymentId: id,
      ...(await readJson<Omit<ReversalPostInput, 'paymentId'>>(request)),
    });
    return NextResponse.json(
      await PaymentService.reversePayment({
        paymentId: id,
        reason: body.reason,
        reversedByUserId: actor.id,
      })
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
