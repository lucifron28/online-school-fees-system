import { NextResponse } from 'next/server';
import type { StudentCreateInput } from '@/lib/students-fees';
import { studentListInputSchema } from '@/lib/students-fees';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { createStudent, listStudents } from '@/server/services/students-fees.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    const params = new URL(request.url).searchParams;
    const input = studentListInputSchema.parse({
      search: params.get('search') ?? undefined,
      status: params.get('status') ?? undefined,
      gradeLevelId: params.get('gradeLevelId') ?? undefined,
      schoolYearId: params.get('schoolYearId') ?? undefined,
      sort: params.get('sort') ?? undefined,
      direction: params.get('direction') ?? undefined,
      page: params.get('page') ?? undefined,
      pageSize: params.get('pageSize') ?? undefined,
    });
    return NextResponse.json(await listStudents(input));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN', 'FINANCE_STAFF']);
    return NextResponse.json(await createStudent(await readJson<StudentCreateInput>(request)), {
      status: 201,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
