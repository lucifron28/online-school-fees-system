import { NextResponse } from 'next/server';
import type { PaymentPostInput } from '@/lib/payments';
import { otcPaymentPostInputSchema, paymentListInputSchema } from '@/lib/payments';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { listPayments, PaymentService } from '@/server/services/payment.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const params = new URL(request.url).searchParams;
    const input = paymentListInputSchema.parse({
      search: params.get('search') ?? undefined,
      status: params.get('status') ?? undefined,
      page: params.get('page') ? Number(params.get('page')) : undefined,
      pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : undefined,
    });
    return NextResponse.json(await listPayments(input));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const body = otcPaymentPostInputSchema.parse(await readJson<PaymentPostInput>(request));
    return NextResponse.json(
      await PaymentService.recordPayment({ ...body, processedByUserId: actor.id }),
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
