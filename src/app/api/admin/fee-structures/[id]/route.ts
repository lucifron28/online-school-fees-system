import { NextResponse } from 'next/server';
import type { FeeStructureUpdateInput } from '@/lib/students-fees';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { getFeeStructure, updateFeeStructure } from '@/server/services/students-fees.service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    return NextResponse.json(await getFeeStructure(id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    return NextResponse.json(
      await updateFeeStructure(id, await readJson<FeeStructureUpdateInput>(request))
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
