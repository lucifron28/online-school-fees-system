import { NextResponse } from 'next/server';
import { generateReceiptPdf } from '@/lib/pdf/receipt-generator';
import { authErrorResponse, requireRequestAuth } from '@/server/auth/guards';

export async function GET(request: Request, { params }: { params: Promise<{ id?: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
  } catch (error) {
    return authErrorResponse(error);
  }

  const resolvedParams = await params;
  const receiptId = resolvedParams?.id || 'OSFS-2026-000123';

  try {
    const pdfBytes = await generateReceiptPdf({
      receiptNumber: receiptId,
      verificationIdentifier: `VER-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      paymentDate: 'May 30, 2024 10:30 AM',
      paymentMethod: 'GCash (Online)',
      referenceNumber: 'PAY-2026-000123',
      studentNumber: 'S2026-0001',
      studentName: 'Juan Dela Cruz Jr.',
      gradeAndSection: 'Grade 10 - A',
      amountReceivedCentavos: 1400000,
      remainingBalanceCentavos: 0,
      processedByName: 'Cashier Staff',
      allocations: [
        { name: 'Tuition Fee (Full Year)', amountCentavos: 1200000 },
        { name: 'Miscellaneous Fee', amountCentavos: 200000 },
      ],
      institution: {
        name: 'Online School Fees Monitoring & Payment System',
        address: '123 Education Way, Manila, Philippines',
        email: 'info@schoolfees.example.com',
        phone: '+63 (2) 8123-4567',
      },
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${receiptId}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate receipt PDF' }, { status: 500 });
  }
}
