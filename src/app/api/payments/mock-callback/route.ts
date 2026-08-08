import { NextResponse } from 'next/server';
import { mockCallbackInputSchema } from '@/lib/portal';
import { readJson, routeErrorResponse } from '@/server/http';
import { processMockCallback } from '@/server/services/payment-gateway.service';

export async function POST(request: Request) {
  try {
    const body = mockCallbackInputSchema.parse(await readJson(request));
    return NextResponse.json(await processMockCallback(body));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
