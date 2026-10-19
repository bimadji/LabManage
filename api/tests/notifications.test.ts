import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { serviceClient } from '../src/supabase.js';
import { runOvernightJob } from '../src/jobs/overnight.js';
import { createTestUser, deleteTestUsers, testConfig, type TestUser } from './helpers/db.js';

const JOB_SECRET = 'job-secret-uji';

let config: Config;
let app: Express;
let anggota: TestUser;
let admin: TestUser;

beforeAll(async () => {
  config = { ...testConfig(), jobSecret: JOB_SECRET };
  app = createApp(config);
  [anggota, admin] = await Promise.all([
    createTestUser(config, 'anggota'),
    createTestUser(config, 'admin'),
  ]);
});

afterAll(async () => {
  const db = serviceClient(config);
  const ids = [anggota, admin].filter(Boolean).map((user) => user.id);
  if (ids.length > 0) {
    await db.from('notifications').delete().in('user_id', ids);
    await db.from('attendance').delete().in('user_id', ids);
    await db.from('facility_reports').delete().in('reported_by', ids);
    await db.from('reservations').delete().in('user_id', ids);
  }
  await deleteTestUsers(config, [anggota, admin].filter(Boolean));
});

function notificationsOf(user: TestUser) {
  return request(app).get('/notifications').set('Authorization', `Bearer ${user.token}`);
}

describe('notifikasi laporan', () => {
  it('transisi status membuat tepat satu notifikasi untuk pelapor', async () => {
    const created = await request(app)
      .post('/facility-reports')
      .set('Authorization', `Bearer ${anggota.token}`)
      .send({ category: 'lampu', description: 'Lampu lorong mati', location: 'Lorong' });
    expect(created.status).toBe(201);

    const moved = await request(app)
      .patch(`/facility-reports/${created.body.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'ditindaklanjuti' });
    expect(moved.status).toBe(200);

    const list = await notificationsOf(anggota);
    const mine = list.body.filter(
      (row: { kind: string; message: string }) =>
        row.kind === 'laporan' && row.message.includes('ditindaklanjuti'),
    );
    expect(mine).toHaveLength(1);
  });
});

describe('POST /internal/jobs/overnight', () => {
  function runJob(secret?: string) {
    const req = request(app).post('/internal/jobs/overnight');
    return secret ? req.set('X-Job-Secret', secret) : req;
  }

  it('tanpa secret → 401', async () => {
    const res = await runJob();
    expect(res.status).toBe(401);
  });

  it('secret salah → 401', async () => {
    const res = await runJob('salah');
    expect(res.status).toBe(401);
  });

  it('secret benar → 200 dengan ringkasan job', async () => {
    const res = await runJob(JOB_SECRET);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ flagged: expect.any(Number), created: expect.any(Number) });
  });
});

describe('runOvernightJob dengan waktu tetap', () => {
  it('membuat satu notifikasi untuk sesi terbuka lewat 21:00, dan idempoten', async () => {
    const db = serviceClient(config);
    // Only this session may be open for this user; other test files run in
    // parallel, so assertions stay scoped to this user's rows.
    await db.from('attendance').delete().eq('user_id', anggota.id);
    const now = new Date('2026-10-20T22:30:00+07:00');
    const { error } = await db
      .from('attendance')
      .insert({ user_id: anggota.id, checked_in_at: '2026-10-20T19:00:00+07:00' });
    if (error) throw error;

    const overtimeCount = async () => {
      const { count } = await db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', anggota.id)
        .eq('kind', 'lembur')
        .like('dedupe_key', `overnight:${anggota.id}:%`);
      return count ?? 0;
    };

    const before = await overtimeCount();
    await runOvernightJob(config, now);
    expect(await overtimeCount()).toBe(before + 1);

    await runOvernightJob(config, now);
    expect(await overtimeCount()).toBe(before + 1);
  });

  it('sesi yang belum lewat 21:00 tidak dinotifikasi', async () => {
    const db = serviceClient(config);
    await db.from('attendance').delete().in('user_id', [anggota.id, admin.id]);
    await db
      .from('attendance')
      .insert({ user_id: admin.id, checked_in_at: '2026-10-21T19:00:00+07:00' });

    await runOvernightJob(config, new Date('2026-10-21T20:59:00+07:00'));
    const { count } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', admin.id)
      .eq('kind', 'lembur');
    expect(count).toBe(0);
  });
});

describe('dedupe_key', () => {
  it('insert kedua dengan dedupe_key sama tidak menambah baris', async () => {
    const db = serviceClient(config);
    const key = `uji:${crypto.randomUUID()}`;
    const payload = { user_id: anggota.id, kind: 'lembur', message: 'uji', dedupe_key: key };

    await db.from('notifications').insert(payload);
    await db.from('notifications').upsert(payload, {
      onConflict: 'dedupe_key',
      ignoreDuplicates: true,
    });

    const { count } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('dedupe_key', key);
    expect(count).toBe(1);
  });
});

describe('GET /notifications dan PATCH read', () => {
  it('anggota hanya melihat notifikasi miliknya', async () => {
    const res = await notificationsOf(anggota);
    expect(res.status).toBe(200);
    expect(res.body.every((row: { id: string }) => typeof row.id === 'string')).toBe(true);
  });

  it('menandai dibaca mengisi readAt', async () => {
    const list = await notificationsOf(anggota);
    const target = list.body[0];
    expect(target).toBeDefined();
    const res = await request(app)
      .patch(`/notifications/${target.id}/read`)
      .set('Authorization', `Bearer ${anggota.token}`);
    expect(res.status).toBe(200);
    expect(res.body.readAt).not.toBeNull();
  });

  it('RLS: anggota tidak dapat menandai notifikasi orang lain', async () => {
    const db = serviceClient(config);
    const { data } = await db
      .from('notifications')
      .insert({
        user_id: admin.id,
        kind: 'reservasi',
        message: 'milik admin',
      })
      .select('id')
      .single();

    expect(data).not.toBeNull();
    const res = await request(app)
      .patch(`/notifications/${data!.id}/read`)
      .set('Authorization', `Bearer ${anggota.token}`);
    expect(res.status).toBe(404);
  });
});
