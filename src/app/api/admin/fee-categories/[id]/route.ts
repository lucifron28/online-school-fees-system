import { NextResponse } from 'next/server';
import type { FeeCategoryUpdateInput } from '@/lib/students-fees';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { updateFeeCategory } from '@/server/services/students-fees.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    return NextResponse.json(
      await updateFeeCategory(id, await readJson<FeeCategoryUpdateInput>(request))
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
