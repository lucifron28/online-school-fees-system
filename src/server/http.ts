import { authErrorResponse } from '@/server/auth/guards';
import { toErrorResponse } from '@/server/errors';
import { ValidationError } from '@/server/errors';

export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ValidationError('Request body must contain valid JSON.');
  }
}

export function routeErrorResponse(error: unknown) {
  if (
    error instanceof Error &&
    ['UNAUTHENTICATED', 'FORBIDDEN', 'STUDENT_PORTAL_DISABLED'].includes(error.message)
  ) {
    return authErrorResponse(error);
  }

  return toErrorResponse(error);
}
