import { NextResponse } from 'next/server';
import type { HealthApiResponse } from '@/types';

export async function GET() {
  const response: HealthApiResponse = {
    status: 'ok',
    service: 'mpps-school-fees-system',
  };

  return NextResponse.json(response, { status: 200 });
}
