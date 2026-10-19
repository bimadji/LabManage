import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = {
  port: 4000,
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseAnonKey: 'anon',
  supabaseServiceRoleKey: 'service',
  webOrigin: 'http://localhost:5173',
  jobSecret: 'uji',
};

describe('GET /health', () => {
  it('mengembalikan status ok', async () => {
    const res = await request(createApp(config)).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('route lain tanpa token → 401', async () => {
    const res = await request(createApp(config)).get('/rooms');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('CORS', () => {
  it('mengizinkan origin web yang dikonfigurasi', async () => {
    const res = await request(createApp(config))
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
