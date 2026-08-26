import { NextResponse } from 'next/server';
import { parseReportDateRangeSearchParams, reportPaginationSchema } from '@/lib/reports';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { ReportService } from '@/server/services/report.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const params = new URL(request.url).searchParams;
    const dateRange = parseReportDateRangeSearchParams(params);
    const pagination = reportPaginationSchema.parse(Object.fromEntries(params));
    return NextResponse.json(
      await ReportService.getCollectionReportPage(dateRange, pagination.page, pagination.pageSize)
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
