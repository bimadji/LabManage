import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  requireAuth,
  requireRole,
  type AuthUser,
  type AuthVerifier,
} from '../src/auth/requireAuth.js';

const users: Record<string, AuthUser> = {
  'token-anggota': { id: 'u-anggota', role: 'anggota' },
  'token-admin': { id: 'u-admin', role: 'admin' },
};

const fakeVerifier: AuthVerifier = {
  verify: async (token) => users[token] ?? null,
};

const app = express();
app.get('/me', requireAuth(fakeVerifier), (req, res) => {
  res.json(req.user);
});
app.get('/admin-only', requireAuth(fakeVerifier), requireRole('admin'), (_req, res) => {
  res.json({ ok: true });
});

describe('requireAuth', () => {
  it('tanpa header Authorization → 401', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('header bukan Bearer → 401', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
  });

  it('token tidak valid → 401', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer token-palsu');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('token valid mengisi req.user', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer token-anggota');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'u-anggota', role: 'anggota' });
  });
});

describe('requireRole', () => {
  it('anggota ke route admin → 403', async () => {
    const res = await request(app).get('/admin-only').set('Authorization', 'Bearer token-anggota');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('admin ke route admin → 200', async () => {
    const res = await request(app).get('/admin-only').set('Authorization', 'Bearer token-admin');
    expect(res.status).toBe(200);
  });
});
