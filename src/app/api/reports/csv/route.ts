import { NextResponse } from 'next/server';
import { ReportService, CollectionReportItem } from '@/server/services/report.service';
import { authErrorResponse, requireRequestAuth } from '@/server/auth/guards';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
  } catch (error) {
    return authErrorResponse(error);
  }

  const sampleItems: CollectionReportItem[] = [
    {
      id: '1',
      receiptNumber: 'OSFS-2026-000123',
      studentName: 'Juan Dela Cruz Jr.',
      amountCentavos: 1400000,
      paymentMethod: 'GCash',
      status: 'POSTED',
      createdAt: new Date('2024-05-30'),
    },
    {
      id: '2',
      receiptNumber: 'OSFS-2026-000122',
      studentName: 'Maria Santos',
      amountCentavos: 1200000,
      paymentMethod: 'GCash',
      status: 'POSTED',
      createdAt: new Date('2024-05-30'),
    },
    {
      id: '3',
      receiptNumber: 'OSFS-2026-000121',
      studentName: 'Pedro Reyes',
      amountCentavos: 1350000,
      paymentMethod: 'Cash',
      status: 'POSTED',
      createdAt: new Date('2024-05-29'),
    },
    {
      id: '4',
      receiptNumber: 'OSFS-2026-000120',
      studentName: 'Ana Garcia',
      amountCentavos: 1200000,
      paymentMethod: 'Maya',
      status: 'REVERSED',
      createdAt: new Date('2024-05-29'),
    },
  ];

  const csvContent = ReportService.generateCsvReport(sampleItems);

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="financial-collections-report.csv"',
    },
  });
}
