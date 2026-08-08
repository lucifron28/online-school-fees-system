import { NextResponse } from 'next/server';
import { generateReceiptPdf } from '@/lib/pdf/receipt-generator';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { getReceiptPdfData } from '@/server/services/payment.service';

export async function GET(request: Request, { params }: { params: Promise<{ id?: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const resolvedParams = await params;
    const receiptId = resolvedParams?.id;
    if (!receiptId) {
      return NextResponse.json({ error: 'Receipt identifier is required.' }, { status: 400 });
    }
    const pdfBytes = await generateReceiptPdf(await getReceiptPdfData(receiptId));

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${receiptId}.pdf"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
