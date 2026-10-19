import express from 'express';
import { requireAuth, supabaseVerifier, type AuthVerifier } from './auth/requireAuth.js';
import type { Config } from './config.js';
import { errorHandler } from './errors.js';
import { reservationsRouter } from './reservations/routes.js';

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp(
  config: Config,
  verifier: AuthVerifier = supabaseVerifier(config),
): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Everything below /health requires a valid Supabase JWT.
  app.use(requireAuth(verifier));
  app.use(reservationsRouter(config));

  app.use(errorHandler);
  return app;
}
