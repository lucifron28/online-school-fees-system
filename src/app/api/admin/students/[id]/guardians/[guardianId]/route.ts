import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/server/auth/guards';
import { routeErrorResponse } from '@/server/http';
import { unlinkGuardianStudent } from '@/server/services/students-fees.service';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; guardianId: string }> }
) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const { id, guardianId } = await params;
    return NextResponse.json(await unlinkGuardianStudent(guardianId, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
