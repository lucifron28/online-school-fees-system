import { NextResponse } from 'next/server';
import type { GradeLevelInput } from '@/lib/administration';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { createGradeLevel, listGradeLevels } from '@/server/services/administration.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    return NextResponse.json(await listGradeLevels());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    return NextResponse.json(await createGradeLevel(await readJson<GradeLevelInput>(request)), {
      status: 201,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
