import { NextResponse } from 'next/server';
import type { GuardianCreateInput } from '@/lib/students-fees';
import { guardianListInputSchema } from '@/lib/students-fees';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { createGuardian, listGuardians } from '@/server/services/students-fees.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const params = new URL(request.url).searchParams;
    const input = guardianListInputSchema.parse({
      search: params.get('search') ?? undefined,
      studentId: params.get('studentId') ?? undefined,
    });
    return NextResponse.json(await listGuardians(input));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    return NextResponse.json(await createGuardian(await readJson<GuardianCreateInput>(request)), {
      status: 201,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
