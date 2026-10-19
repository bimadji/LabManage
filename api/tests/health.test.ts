import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = {
  port: 4000,
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseAnonKey: 'anon',
  supabaseServiceRoleKey: 'service',
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
