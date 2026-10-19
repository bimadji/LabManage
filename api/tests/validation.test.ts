import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { AuthVerifier } from '../src/auth/requireAuth.js';
import type { Config } from '../src/config.js';
import { serviceClient } from '../src/supabase.js';
import { createTestUser, deleteTestUsers, testConfig, type TestUser } from './helpers/db.js';

let config: Config;
let app: Express;
let anggota: TestUser;

beforeAll(async () => {
  config = testConfig();
  app = createApp(config);
  anggota = await createTestUser(config, 'anggota');
});

afterAll(async () => {
  if (anggota) await deleteTestUsers(config, [anggota]);
});

function authed() {
  return { Authorization: `Bearer ${anggota.token}` };
}

describe('validasi body', () => {
  it('body reservasi tidak valid → 400 VALIDATION_ERROR dengan daftar field', async () => {
    const res = await request(app)
      .post('/reservations')
      .set(authed())
      .send({ roomId: 'bukan-uuid', team: '', startsAt: 'kemarin', endsAt: 42 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.issues.map((issue: { path: string }) => issue.path).sort();
    expect(paths).toEqual(['endsAt', 'roomId', 'startsAt', 'team']);
  });

  it('field tak dikenal diabaikan, bukan disimpan', async () => {
    const res = await request(app).post('/facility-reports').set(authed()).send({
      category: 'lampu',
      description: 'Lampu berkedip',
      location: 'Ruang A',
      status: 'selesai',
      reported_by: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('baru');
    expect(res.body.reportedBy).toBe(anggota.id);
  });

  it('deskripsi terlalu pendek → 400 dengan pesan field', async () => {
    const res = await request(app)
      .post('/facility-reports')
      .set(authed())
      .send({ category: 'lampu', description: 'abc', location: 'Ruang A' });
    expect(res.status).toBe(400);
    expect(res.body.error.issues[0].path).toBe('description');
  });

  it('query tidak valid → 400', async () => {
    const res = await request(app).get('/reservations?from=kemarin').set(authed());
    expect(res.status).toBe(400);
    expect(res.body.error.issues[0].path).toBe('from');
  });

  it('filter inventaris tidak dikenal → 400 dengan pesan field', async () => {
    const res = await request(app).get('/inventory?kind=alat').set(authed());
    expect(res.status).toBe(400);
    expect(res.body.error.issues[0].path).toBe('kind');
  });
});

describe('handler error global', () => {
  it('error tak terduga → 500 INTERNAL tanpa stack trace', async () => {
    const exploding: AuthVerifier = {
      verify: async () => {
        throw new Error('koneksi database putus: detail internal');
      },
    };
    const brokenApp = createApp(config, exploding);

    const res = await request(brokenApp).get('/rooms').set({ Authorization: 'Bearer apa-saja' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL', message: 'Terjadi kesalahan pada server' },
    });
    expect(JSON.stringify(res.body)).not.toContain('detail internal');
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });

  it('body JSON rusak → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/facility-reports')
      .set(authed())
      .set('Content-Type', 'application/json')
      .send('{bukan json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('tidak ada kebocoran service role', () => {
  it('respons API tidak memuat kunci service role', async () => {
    const res = await request(app).get('/rooms').set(authed());
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(config.supabaseServiceRoleKey);
    const { data } = await serviceClient(config).from('profiles').select('id').limit(1);
    expect(Array.isArray(data)).toBe(true);
  });
});
