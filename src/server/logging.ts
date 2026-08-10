import { randomUUID } from 'node:crypto';

function safeErrorName(error: unknown) {
  const name = error instanceof Error && error.name ? error.name : 'UnknownError';
  return name.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80) || 'UnknownError';
}

/** Logs operational context without serializing an exception or its message. */
export function logSanitizedError(context: string, error: unknown, correlationId = randomUUID()) {
  console.error('[server-error]', {
    context,
    errorName: safeErrorName(error),
    correlationId,
  });
  return correlationId;
}
