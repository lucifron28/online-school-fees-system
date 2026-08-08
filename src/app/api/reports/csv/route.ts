import { NextResponse } from 'next/server';
import { parseReportDateRangeSearchParams, reportKindSchema } from '@/lib/reports';
import { ReportService } from '@/server/services/report.service';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const searchParams = new URL(request.url).searchParams;
    const kind = reportKindSchema.parse(searchParams.get('kind') ?? 'collections');
    const dateRange = parseReportDateRangeSearchParams(searchParams);
    const csvContent = await ReportService.getReportForCsv(kind, dateRange);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${kind}-report.csv"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
