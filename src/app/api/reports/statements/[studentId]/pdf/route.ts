import { NextResponse } from 'next/server';
import { parseReportDateRangeSearchParams } from '@/lib/reports';
import { generateStatementPdf } from '@/lib/pdf/statement-generator';
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
    const statement = await ReportService.getStudentStatement(
      studentId,
      parseReportDateRangeSearchParams(searchParams)
    );
    const pdf = await generateStatementPdf(statement);
    return new NextResponse(pdf as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="statement-${statement.student.studentNumber}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
