import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { getMockCheckout } from '@/server/services/payment-gateway.service';
import { assertMockPaymentHarnessEnabled } from '@/server/services/mock-payment-harness';
import { PortalService } from '@/server/services/portal.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    assertMockPaymentHarnessEnabled();
    const actor = await requireRequestAuth(request, ['PARENT']);
    const { reference } = await params;
    const checkout = await getMockCheckout(reference);
    await PortalService.verifyParentChildAccess(actor.id, checkout.studentId);
    return NextResponse.json({
      id: checkout.id,
      paymentReference: checkout.checkoutReference,
      studentId: checkout.studentId,
      assessmentId: checkout.assessmentId,
      amountCentavos: checkout.amountCentavos,
      status: checkout.status,
      paymentId: checkout.paymentId,
      expiresAt: checkout.expiresAt,
      completedAt: checkout.completedAt,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
