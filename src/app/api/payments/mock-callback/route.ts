import { NextResponse } from 'next/server';
import { MockPaymentGateway } from '@/server/services/payment-gateway.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentReference, status, amountCentavos, studentId } = body;

    if (!paymentReference) {
      return NextResponse.json({ error: 'Missing paymentReference parameter' }, { status: 400 });
    }

    const gateway = new MockPaymentGateway();
    const verification = await gateway.verifyPayment(paymentReference);

    const result = MockPaymentGateway.processCallback(
      paymentReference,
      status || 'SUCCESS',
      amountCentavos || 1400000,
      studentId || 'std-001'
    );

    return NextResponse.json({
      status: 'ok',
      paymentReference,
      verificationStatus: verification.status,
      isAlreadyProcessed: result.isAlreadyProcessed,
      duplicatePrevented: result.isAlreadyProcessed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to process online payment callback';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
