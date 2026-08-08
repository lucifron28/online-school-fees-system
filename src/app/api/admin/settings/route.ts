import { NextResponse } from 'next/server';
import type { SchoolSettingsInput } from '@/lib/administration';
import { requireRequestAuth } from '@/server/auth/guards';
import { readJson, routeErrorResponse } from '@/server/http';
import {
  getAdministrationSnapshot,
  serializeAdministrationSnapshot,
  updateSchoolSettings,
} from '@/server/services/administration.service';

export async function GET(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    const snapshot = await getAdministrationSnapshot();
    return NextResponse.json(serializeAdministrationSnapshot(snapshot));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireRequestAuth(request, ['ADMIN']);
    const updated = await updateSchoolSettings(await readJson<SchoolSettingsInput>(request));
    return NextResponse.json({
      ...updated,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
