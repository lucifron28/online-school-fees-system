import { NextResponse } from 'next/server';
import type { GuardianStudentLinkInput } from '@/lib/students-fees';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { linkGuardianStudent, listStudentGuardians } from '@/server/services/students-fees.service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    return NextResponse.json(await listStudentGuardians(id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id } = await params;
    const body = await readJson<Omit<GuardianStudentLinkInput, 'studentId'>>(request);
    return NextResponse.json(await linkGuardianStudent({ ...body, studentId: id }), {
      status: 201,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
