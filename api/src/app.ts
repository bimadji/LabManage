import cors from 'cors';
import express from 'express';
import { requireAuth, supabaseVerifier, type AuthVerifier } from './auth/requireAuth.js';
import { attendanceRouter } from './attendance/routes.js';
import type { Config } from './config.js';
import { inventoryRouter } from './inventory/routes.js';
import { errorHandler } from './errors.js';
import { jobsRouter } from './jobs/routes.js';
import { notificationsRouter } from './notifications/routes.js';
import { reportsRouter } from './reports/routes.js';
import { reservationsRouter } from './reservations/routes.js';

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp(
  config: Config,
  verifier: AuthVerifier = supabaseVerifier(config),
): express.Express {
  const app = express();
  // The web app is served from another origin, so browsers need this to call the API.
  app.use(cors({ origin: config.webOrigin, allowedHeaders: ['Authorization', 'Content-Type'] }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Internal jobs authenticate with X-Job-Secret, not a user JWT.
  app.use(jobsRouter(config));

  // Everything below requires a valid Supabase JWT.
  app.use(requireAuth(verifier));
  app.use(attendanceRouter(config));
  app.use(inventoryRouter(config));
  app.use(reportsRouter(config));
  app.use(notificationsRouter(config));
  app.use(reservationsRouter(config));

  app.use(errorHandler);
  return app;
}
