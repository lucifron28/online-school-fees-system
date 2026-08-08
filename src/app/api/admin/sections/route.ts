import { NextResponse } from 'next/server';
import type { SectionInput } from '@/lib/administration';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { createSection, listSections } from '@/server/services/administration.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    return NextResponse.json(await listSections());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    return NextResponse.json(await createSection(await readJson<SectionInput>(request)), {
      status: 201,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
