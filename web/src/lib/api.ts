import { supabase } from './supabase';

export interface ApiErrorBody {
  code: string;
  message: string;
}

/** A failed API call. `code` is the server's stable error code (e.g. CONFLICT). */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function currentToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Calls the LabManage API with the signed-in user's bearer token.
 * Throws `ApiRequestError` for any non-2xx response.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await currentToken();
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: ApiErrorBody } | null;
    throw new ApiRequestError(
      response.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? 'Permintaan gagal. Coba lagi.',
    );
  }

  return (await response.json()) as T;
}
