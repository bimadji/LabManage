import express from 'express';

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
