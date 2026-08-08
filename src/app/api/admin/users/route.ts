import { NextResponse } from 'next/server';
import type { UserCreateInput } from '@/lib/administration';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import { createUser, listUsers } from '@/server/services/administration.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    return NextResponse.json(await listUsers());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    return NextResponse.json(await createUser(await readJson<UserCreateInput>(request)), {
      status: 201,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
