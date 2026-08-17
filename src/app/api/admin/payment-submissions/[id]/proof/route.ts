import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { getPaymentProof } from '@/server/services/payment-submission.service';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    const proof = await getPaymentProof(id, actor, undefined);
    return new Response(new Uint8Array(proof.data), {
      headers: {
        'Content-Type': proof.mimeType,
        'Content-Disposition': `inline; filename="${proof.originalFileName.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
