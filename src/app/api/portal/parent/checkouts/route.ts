import { NextResponse } from 'next/server';
import { portalCheckoutInputSchema } from '@/lib/portal';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { MockPaymentGateway } from '@/server/services/payment-gateway.service';
import { getStudentAccountForUser } from '@/server/services/portal.service';
import { ValidationError } from '@/server/errors/index';

export async function POST(request: Request) {
  try {
    const actor = await requireRequestAuth(request, ['PARENT']);
    const input = portalCheckoutInputSchema.parse(await readJson(request));
    const account = await getStudentAccountForUser(actor.id, 'PARENT', input.studentId);
    if (input.amountCentavos > account.ledger.balanceCentavos) {
      throw new ValidationError('The checkout amount exceeds the current outstanding balance.');
    }

    const result = await new MockPaymentGateway().createCheckout({
      ...input,
      assessmentId: account.assessments[0]?.id ?? null,
      parentUserId: actor.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
