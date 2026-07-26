export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function handle<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}) as Record<string, unknown>);
  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.';
    throw new ApiError(message, response.status);
  }
  return data as T;
}

function request<T>(path: string, init?: RequestInit): Promise<T> {
  return fetch(`/api${path}`, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  }).then((response) => handle<T>(response));
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) });
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
