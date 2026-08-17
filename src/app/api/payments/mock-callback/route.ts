import { NextResponse } from 'next/server';
import { mockCallbackInputSchema } from '@/lib/portal';
import { readJson, routeErrorResponse } from '@/server/http';
import { processMockCallback } from '@/server/services/payment-gateway.service';
import { assertMockPaymentHarnessEnabled } from '@/server/services/mock-payment-harness';

export async function POST(request: Request) {
  try {
    assertMockPaymentHarnessEnabled();
    const body = mockCallbackInputSchema.parse(await readJson(request));
    return NextResponse.json(await processMockCallback(body));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
