import type { PostgrestError } from '@supabase/supabase-js';
import type { ErrorRequestHandler } from 'express';

/** An error with an HTTP status and a stable code, rendered as `{"error":{"code","message"}}`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** Maps a PostgREST/Postgres error to an ApiError; unknown errors become 500 with the cause kept for logs. */
export function fromDbError(error: PostgrestError): ApiError {
  switch (error.code) {
    case '22P02': // invalid_text_representation (e.g. malformed uuid)
    case '23503': // foreign_key_violation
    case '23514': // check_violation
      return new ApiError(400, 'VALIDATION_ERROR', 'Data tidak valid', { cause: error });
    case '42501': // insufficient_privilege / RLS violation
      return new ApiError(403, 'FORBIDDEN', 'Anda tidak berhak melakukan aksi ini', {
        cause: error,
      });
    default:
      return new ApiError(500, 'INTERNAL', 'Terjadi kesalahan pada server', { cause: error });
  }
}

// Express recognises error handlers by arity, so all four parameters must stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    if (err.status >= 500) console.error(err.cause ?? err);
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Body JSON tidak valid' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Terjadi kesalahan pada server' } });
};
