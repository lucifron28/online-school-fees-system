import { NextResponse } from 'next/server';
import type { FeeStructureItemUpdateInput } from '@/lib/students-fees';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { updateFeeStructureItem } from '@/server/services/students-fees.service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id, itemId } = await params;
    return NextResponse.json(
      await updateFeeStructureItem(id, itemId, await readJson<FeeStructureItemUpdateInput>(request))
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
