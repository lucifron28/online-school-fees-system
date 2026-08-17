export type CronAuthorizationFailure = {
  status: 401 | 503;
  message: string;
};

function providedCronSecret(request: Request) {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length);
  return request.headers.get('x-cron-secret');
}

export function getCronAuthorizationFailure(
  request: Request,
  configuredSecret: string | undefined
): CronAuthorizationFailure | null {
  if (!configuredSecret) {
    return { status: 503, message: 'CRON_SECRET is not configured.' };
  }
  if (providedCronSecret(request) !== configuredSecret) {
    return { status: 401, message: 'Invalid cron credentials.' };
  }
  return null;
}
