import { NextResponse } from 'next/server';
import type { SchoolYearInput } from '@/lib/administration';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { createSchoolYear, listSchoolYears } from '@/server/services/administration.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    return NextResponse.json(await listSchoolYears());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    return NextResponse.json(await createSchoolYear(await readJson<SchoolYearInput>(request)), {
      status: 201,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
