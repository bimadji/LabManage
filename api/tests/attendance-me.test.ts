import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { serviceClient } from '../src/supabase.js';
import { createTestUser, deleteTestUsers, testConfig, type TestUser } from './helpers/db.js';

let config: Config;
let app: Express;
let member: TestUser;
let other: TestUser;
let admin: TestUser;
let advisor: TestUser;
let openId: string;
let closedId: string;

beforeAll(async () => {
  config = testConfig();
  app = createApp(config);
  [member, other, admin, advisor] = await Promise.all([
    createTestUser(config, 'anggota'),
    createTestUser(config, 'anggota'),
    createTestUser(config, 'admin'),
    createTestUser(config, 'advisor'),
  ]);
  const { data, error } = await serviceClient(config)
    .from('attendance')
    .insert([
      {
        user_id: member.id,
        checked_in_at: '2025-01-01T16:30:00Z',
        checked_out_at: '2025-01-01T18:00:00Z',
      },
      { user_id: member.id, checked_in_at: new Date(Date.now() - 90 * 60_000).toISOString() },
      { user_id: other.id, checked_in_at: new Date().toISOString() },
    ])
    .select('id, user_id, checked_out_at');
  if (error) throw error;
  openId = data.find((row) => row.user_id === member.id && !row.checked_out_at)!.id;
  closedId = data.find((row) => row.checked_out_at)!.id;
});

afterAll(async () => {
  const users = [member, other, admin, advisor].filter(Boolean);
  if (users.length) {
    await serviceClient(config)
      .from('attendance')
      .delete()
      .in(
        'user_id',
        users.map((user) => user.id),
      );
  }
  await deleteTestUsers(config, users);
});

function getMine(user: TestUser, query = '') {
  return request(app).get(`/attendance/me${query}`).set('Authorization', `Bearer ${user.token}`);
}

describe('GET /attendance/me', () => {
  it('tanpa autentikasi ditolak', async () => {
    expect((await request(app).get('/attendance/me')).status).toBe(401);
  });

  it('mengembalikan sesi sendiri terbaru beserta durasi berjalan', async () => {
    const res = await getMine(member);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: openId,
      userId: member.id,
      checkedOutAt: null,
      durationMinutes: 90,
    });
  });

  it('parameter userId tidak dapat dipakai membaca sesi orang lain', async () => {
    const res = await getMine(member, `?userId=${other.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(openId);
    expect(res.body.userId).toBe(member.id);
  });

  it('admin yang belum punya sesi mendapat null, bukan sesi anggota lain', async () => {
    const res = await getMine(admin);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('advisor tidak dapat memakai halaman kehadiran pribadi', async () => {
    expect((await getMine(advisor)).status).toBe(403);
  });

  it('sesi selesai lintas tengah malam tetap dapat dimuat dengan durasi akhirnya', async () => {
    // Hapus hanya sesi terbuka milik fixture ini agar sesi selesai menjadi yang terbaru.
    const { error } = await serviceClient(config).from('attendance').delete().eq('id', openId);
    expect(error).toBeNull();
    const res = await getMine(member);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: closedId,
      userId: member.id,
      durationMinutes: 90,
    });
    expect(res.body.checkedOutAt).not.toBeNull();
  });
});
