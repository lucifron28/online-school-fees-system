import { NextResponse } from 'next/server';
import { parseReportDateRangeSearchParams } from '@/lib/reports';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { ReportService } from '@/server/services/report.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const params = new URL(request.url).searchParams;
    return NextResponse.json(
      await ReportService.getReversalReportPage(
        parseReportDateRangeSearchParams(params),
        params.get('page') ? Number(params.get('page')) : undefined,
        params.get('pageSize') ? Number(params.get('pageSize')) : undefined
      )
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
