import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { ReportService } from '@/server/services/report.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    return NextResponse.json({ items: await ReportService.getOutstandingBalanceReport() });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
