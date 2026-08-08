import { NextResponse } from 'next/server';
import type { FeeStructureItemInput } from '@/lib/students-fees';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { addFeeStructureItem } from '@/server/services/students-fees.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    return NextResponse.json(
      await addFeeStructureItem(id, await readJson<FeeStructureItemInput>(request)),
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
