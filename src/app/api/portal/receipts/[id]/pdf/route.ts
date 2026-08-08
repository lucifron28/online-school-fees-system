import { NextResponse } from 'next/server';
import { generateReceiptPdf } from '@/lib/pdf/receipt-generator';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { getOwnedReceiptPdfData } from '@/server/services/portal.service';

export async function GET(request: Request, { params }: { params: Promise<{ id?: string }> }) {
  try {
    const actor = await requireRequestAuth(request, ['PARENT', 'STUDENT']);
    if (actor.role !== 'PARENT' && actor.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!id)
      return NextResponse.json({ error: 'Receipt identifier is required.' }, { status: 400 });

    const pdfBytes = await generateReceiptPdf(
      await getOwnedReceiptPdfData(actor.id, actor.role, id)
    );
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${id}.pdf"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
