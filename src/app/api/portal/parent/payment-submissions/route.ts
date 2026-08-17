import { NextResponse } from 'next/server';
import {
  paymentSubmissionCreateInputSchema,
  paymentSubmissionListInputSchema,
} from '@/lib/payment-submissions';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import {
  assertPaymentProofRequestSize,
  createPaymentSubmission,
  listParentPaymentSubmissions,
} from '@/server/services/payment-submission.service';
import { ValidationError } from '@/server/errors';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = await requireRequestAuth(request, ['PARENT']);
    const url = new URL(request.url);
    const input = paymentSubmissionListInputSchema.parse(Object.fromEntries(url.searchParams));
    return NextResponse.json(await listParentPaymentSubmissions(actor.id, input));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertPaymentProofRequestSize(request);
    const actor = await requireRequestAuth(request, ['PARENT']);
    const formData = await request.formData();
    const proof = formData.get('proof');
    if (!(proof instanceof File)) {
      throw new ValidationError('A JPEG, PNG, or WebP payment proof image is required.');
    }
    const values = paymentSubmissionCreateInputSchema.parse({
      studentId: String(formData.get('studentId') ?? ''),
      paymentChannel: String(formData.get('paymentChannel') ?? ''),
      amountCentavos: Number(formData.get('amountCentavos') ?? 0),
      referenceNumber: String(formData.get('referenceNumber') ?? ''),
      paidAt: String(formData.get('paidAt') ?? ''),
      idempotencyKey: String(formData.get('idempotencyKey') ?? ''),
    });
    const result = await createPaymentSubmission(
      {
        ...values,
        proof: {
          mimeType: proof.type,
          originalFileName: proof.name,
          data: Buffer.from(await proof.arrayBuffer()),
        },
      },
      actor.id
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
