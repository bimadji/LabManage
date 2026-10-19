import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ApiError, type ValidationIssue } from './errors.js';

// Keep every default Zod message in Indonesian.
z.config(z.locales.id());

/**
 * Validates `req.body` or `req.query` against a Zod schema and replaces it with
 * the parsed value. Failures become 400 `VALIDATION_ERROR` with a field list.
 */
export function validate(schema: z.ZodType, source: 'body' | 'query' = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      const error = new ApiError(400, 'VALIDATION_ERROR', 'Data tidak valid');
      error.issues = issues;
      next(error);
      return;
    }
    if (source === 'body') req.body = result.data;
    else Object.assign(req.query, result.data);
    next();
  };
}

/** ISO 8601 instant, e.g. `2026-10-20T09:00:00+07:00`. */
export const isoInstant = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'harus berupa waktu ISO 8601',
});

export const uuid = z.string().uuid({ message: 'harus berupa uuid' });
