import { NextResponse } from 'next/server';
import type { FeeCategoryCreateInput } from '@/lib/students-fees';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { createFeeCategory, listFeeCategories } from '@/server/services/students-fees.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    return NextResponse.json(await listFeeCategories());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    return NextResponse.json(
      await createFeeCategory(await readJson<FeeCategoryCreateInput>(request)),
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
