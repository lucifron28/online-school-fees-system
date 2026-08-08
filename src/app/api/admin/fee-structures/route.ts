import { NextResponse } from 'next/server';
import type { FeeStructureCreateInput } from '@/lib/students-fees';
import { feeStructureListInputSchema } from '@/lib/students-fees';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { createFeeStructure, listFeeStructures } from '@/server/services/students-fees.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const params = new URL(request.url).searchParams;
    const input = feeStructureListInputSchema.parse({
      schoolYearId: params.get('schoolYearId') ?? undefined,
      gradeLevelId: params.get('gradeLevelId') ?? undefined,
      status: params.get('status') ?? undefined,
    });
    return NextResponse.json(await listFeeStructures(input));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    return NextResponse.json(
      await createFeeStructure(await readJson<FeeStructureCreateInput>(request)),
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
