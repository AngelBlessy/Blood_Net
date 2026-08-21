// Empty by default, which keeps requests same-origin — the local dev proxy
// (vite.config.ts) and the old same-server deployment both rely on that. Set
// VITE_API_URL (e.g. to the Fly.io app URL) when the client is deployed
// separately from the API, such as on Vercel.
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  code?: string;
  // The full parsed error response body, for endpoints that attach extra
  // structured fields (e.g. login's rejected-account response includes
  // `role` and `rejectionReason` alongside the message).
  data?: Record<string, unknown>;

  constructor(message: string, status: number, code?: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function handle<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}) as Record<string, unknown>);
  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.';
    const code = typeof data.code === 'string' ? data.code : undefined;
    throw new ApiError(message, response.status, code, data);
  }
  return data as T;
}

function request<T>(path: string, init?: RequestInit): Promise<T> {
  return fetch(`${API_BASE_URL}/api${path}`, {
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

// For multipart/form-data submissions (e.g. registration or a profile edit
// with a file attached). Deliberately omits the Content-Type header -- the
// browser sets it itself, including the multipart boundary, which
// JSON.stringify-based apiPost/apiPatch can't do.
function requestForm<T>(path: string, method: string, formData: FormData): Promise<T> {
  return fetch(`${API_BASE_URL}/api${path}`, {
    method,
    credentials: 'include',
    body: formData,
  }).then((response) => handle<T>(response));
}

export function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  return requestForm<T>(path, 'POST', formData);
}

export function apiPatchForm<T>(path: string, formData: FormData): Promise<T> {
  return requestForm<T>(path, 'PATCH', formData);
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
