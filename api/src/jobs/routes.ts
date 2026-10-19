import { Router, type RequestHandler } from 'express';
import type { Config } from '../config.js';
import { ApiError } from '../errors.js';
import { runOvernightJob } from '../jobs/overnight.js';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Internal job endpoints. Protected by `X-Job-Secret` (env `JOB_SECRET`) instead
 * of a user JWT, so it is mounted BEFORE `requireAuth`.
 */
export function jobsRouter(config: Config): Router {
  const router = Router();

  const requireJobSecret: RequestHandler = (req, res, next) => {
    const provided = req.get('x-job-secret');
    if (!config.jobSecret || !provided || !timingSafeEqual(provided, config.jobSecret)) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Secret job tidak valid' } });
      return;
    }
    next();
  };

  router.post('/internal/jobs/overnight', requireJobSecret, async (_req, res) => {
    if (!config.jobSecret) throw new ApiError(500, 'INTERNAL', 'JOB_SECRET belum diatur');
    res.json(await runOvernightJob(config, new Date()));
  });

  return router;
}
