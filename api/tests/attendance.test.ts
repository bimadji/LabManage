import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { serviceClient } from '../src/supabase.js';
import { createTestUser, deleteTestUsers, testConfig, type TestUser } from './helpers/db.js';

let config: Config;
let app: Express;
let anggotaA: TestUser;
let anggotaB: TestUser;
let admin: TestUser;
let advisor: TestUser;

beforeAll(async () => {
  config = testConfig();
  app = createApp(config);
  [anggotaA, anggotaB, admin, advisor] = await Promise.all([
    createTestUser(config, 'anggota'),
    createTestUser(config, 'anggota'),
    createTestUser(config, 'admin'),
    createTestUser(config, 'advisor'),
  ]);
});

afterAll(async () => {
  const db = serviceClient(config);
  const ids = [anggotaA, anggotaB, admin, advisor].filter(Boolean).map((user) => user.id);
  if (ids.length > 0) await db.from('attendance').delete().in('user_id', ids);
  await deleteTestUsers(config, [anggotaA, anggotaB, admin, advisor].filter(Boolean));
});

function post(path: string, user: TestUser) {
  return request(app).post(path).set('Authorization', `Bearer ${user.token}`);
}

describe('POST /attendance/check-in', () => {
  it('membuka sesi dan mengembalikan waktu mulai', async () => {
    const res = await post('/attendance/check-in', anggotaA);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ userId: anggotaA.id, checkedOutAt: null });
    expect(Date.parse(res.body.checkedInAt)).toBeGreaterThan(0);
  });

  it('check-in kedua saat sesi masih terbuka → 409 ALREADY_IN', async () => {
    const res = await post('/attendance/check-in', anggotaA);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_IN');
  });

  it('dua check-in bersamaan hanya membuka satu sesi', async () => {
    const [first, second] = await Promise.all([
      post('/attendance/check-in', anggotaB),
      post('/attendance/check-in', anggotaB),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const { count } = await serviceClient(config)
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', anggotaB.id)
      .is('checked_out_at', null);
    expect(count).toBe(1);
  });
});

describe('POST /attendance/check-out', () => {
  it('menutup sesi terbuka', async () => {
    const res = await post('/attendance/check-out', anggotaA);
    expect(res.status).toBe(200);
    expect(res.body.checkedOutAt).not.toBeNull();
  });

  it('check-out tanpa sesi terbuka → 404 NOT_IN', async () => {
    const res = await post('/attendance/check-out', anggotaA);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_IN');
  });
});

describe('GET /attendance/present', () => {
  it('admin melihat sesi terbuka beserta nama anggota', async () => {
    const res = await request(app)
      .get('/attendance/present')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const entry = res.body.find((row: { userId: string }) => row.userId === anggotaB.id);
    expect(entry).toBeDefined();
    expect(entry.fullName).toBe('Test anggota');
  });

  it('advisor dapat melihat daftar beserta nama anggota', async () => {
    const res = await request(app)
      .get('/attendance/present')
      .set('Authorization', `Bearer ${advisor.token}`);
    expect(res.status).toBe(200);
    const entry = res.body.find((row: { userId: string }) => row.userId === anggotaB.id);
    expect(entry?.fullName).toBe('Test anggota');
  });

  it('anggota → 403', async () => {
    const res = await request(app)
      .get('/attendance/present')
      .set('Authorization', `Bearer ${anggotaA.token}`);
    expect(res.status).toBe(403);
  });
});

describe('RLS attendance', () => {
  it('anggota A tidak dapat membaca sesi anggota B', async () => {
    const { data, error } = await anggotaA.client
      .from('attendance')
      .select('id, user_id')
      .eq('user_id', anggotaB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('anggota A tidak dapat menutup sesi anggota B', async () => {
    const { data } = await anggotaA.client
      .from('attendance')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('user_id', anggotaB.id)
      .select('id');
    expect(data).toEqual([]);

    const { count } = await serviceClient(config)
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', anggotaB.id)
      .is('checked_out_at', null);
    expect(count).toBe(1);
  });

  it('anggota tidak dapat membuka sesi atas nama anggota lain', async () => {
    const { error } = await anggotaA.client.from('attendance').insert({ user_id: anggotaB.id });
    expect(error?.code).toBe('42501');
  });

  it('advisor tidak dapat check-in', async () => {
    const res = await post('/attendance/check-in', advisor);
    expect(res.status).toBe(403);
  });
});
