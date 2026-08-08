import { NextResponse } from 'next/server';
import { parseReportDateRangeSearchParams } from '@/lib/reports';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { ReportService } from '@/server/services/report.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { studentId } = await params;
    const searchParams = new URL(request.url).searchParams;
    return NextResponse.json(
      await ReportService.getStudentStatement(
        studentId,
        parseReportDateRangeSearchParams(searchParams)
      )
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
