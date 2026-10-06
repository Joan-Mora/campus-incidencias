import { getToken, useAuth } from '../auth/store';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  query?: Query;
  signal?: AbortSignal;
}

export function apiUrl(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_URL}${path}${search ? `?${search}` : ''}`;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(apiUrl(path, options.query), {
      method: options.method ?? (options.body || options.form ? 'POST' : 'GET'),
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError('Sin conexión con el servidor', 0);
  }

  if (response.status === 401 && token) useAuth.getState().logout();
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string; field?: string } | null;
    throw new ApiError(data?.error ?? 'Algo salió mal, intenta de nuevo', response.status, data?.field);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** URL absoluta de una evidencia (local en /uploads o servida desde la base). */
export function mediaUrl(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

export function wsUrl(token: string) {
  const base = API_URL || window.location.origin;
  return `${base.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`;
}
