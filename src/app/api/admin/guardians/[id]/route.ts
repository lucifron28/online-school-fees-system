import { NextResponse } from 'next/server';
import type { GuardianUpdateInput } from '@/lib/students-fees';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { getGuardian, updateGuardian } from '@/server/services/students-fees.service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    return NextResponse.json(await getGuardian(id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    return NextResponse.json(
      await updateGuardian(id, await readJson<GuardianUpdateInput>(request))
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
