export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as
    { error?: string; details?: Record<string, string[]> } | T | null;

  if (!response.ok) {
    if (body && typeof body === 'object' && 'error' in body && body.error) {
      throw new Error(body.error);
    }
    throw new Error(`Request failed with status ${response.status}.`);
  }

  return body as T;
}

export function getClientErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}
