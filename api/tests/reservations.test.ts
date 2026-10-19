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
let roomId: string;

beforeAll(async () => {
  config = testConfig();
  app = createApp(config);
  [anggotaA, anggotaB, admin, advisor] = await Promise.all([
    createTestUser(config, 'anggota'),
    createTestUser(config, 'anggota'),
    createTestUser(config, 'admin'),
    createTestUser(config, 'advisor'),
  ]);
  const { data, error } = await serviceClient(config)
    .from('rooms')
    .insert({ name: `Ruang Test ${crypto.randomUUID()}`, kind: 'ruang' })
    .select('id')
    .single();
  if (error) throw error;
  roomId = data.id;
});

afterAll(async () => {
  const db = serviceClient(config);
  await db.from('reservations').delete().eq('room_id', roomId);
  await db.from('rooms').delete().eq('id', roomId);
  await deleteTestUsers(config, [anggotaA, anggotaB, admin, advisor].filter(Boolean));
});

// Each test uses its own day so reservations never overlap across tests.
let dayOffset = 0;
function slot(startHour = 9, endHour = 10) {
  dayOffset++;
  const day = new Date(Date.UTC(2030, 0, 1 + dayOffset));
  const date = day.toISOString().slice(0, 10);
  const hh = (h: number) => String(h).padStart(2, '0');
  return {
    startsAt: `${date}T${hh(startHour)}:00:00+07:00`,
    endsAt: `${date}T${hh(endHour)}:00:00+07:00`,
  };
}

function create(user: TestUser, body: object) {
  return request(app).post('/reservations').set('Authorization', `Bearer ${user.token}`).send(body);
}

describe('GET /rooms', () => {
  it('semua peran dapat membaca daftar ruang', async () => {
    for (const user of [anggotaA, admin, advisor]) {
      const res = await request(app).get('/rooms').set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect(res.body.some((r: { id: string }) => r.id === roomId)).toBe(true);
    }
  });
});

describe('POST /reservations', () => {
  it('anggota membuat reservasi; userId diambil dari token, bukan body', async () => {
    const res = await create(anggotaA, {
      roomId,
      team: 'Robotik',
      ...slot(),
      userId: anggotaB.id,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      roomId,
      team: 'Robotik',
      userId: anggotaA.id,
      status: 'aktif',
    });
  });

  it('endsAt <= startsAt → 400', async () => {
    const { startsAt } = slot();
    const res = await create(anggotaA, { roomId, team: 'Robotik', startsAt, endsAt: startsAt });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('roomId hilang → 400', async () => {
    const res = await create(anggotaA, { team: 'Robotik', ...slot() });
    expect(res.status).toBe(400);
  });

  it('roomId bukan uuid → 400', async () => {
    const res = await create(anggotaA, { roomId: 'bukan-uuid', team: 'Robotik', ...slot() });
    expect(res.status).toBe(400);
  });

  it('advisor tidak dapat membuat reservasi → 403', async () => {
    const res = await create(advisor, { roomId, team: 'Robotik', ...slot() });
    expect(res.status).toBe(403);
  });
});

describe('GET /reservations', () => {
  it('mengembalikan reservasi yang overlap dengan rentang from/to', async () => {
    const s = slot(13, 14);
    const created = await create(anggotaA, { roomId, team: 'Robotik', ...s });
    const res = await request(app)
      .get('/reservations')
      .query({ from: s.startsAt, to: s.endsAt })
      .set('Authorization', `Bearer ${advisor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((r: { id: string }) => r.id)).toContain(created.body.id);
  });

  it('from tidak valid → 400', async () => {
    const res = await request(app)
      .get('/reservations')
      .query({ from: 'kemarin' })
      .set('Authorization', `Bearer ${anggotaA.token}`);
    expect(res.status).toBe(400);
  });
});

describe('PATCH /reservations/:id/cancel', () => {
  it('pemilik dapat membatalkan', async () => {
    const created = await create(anggotaA, { roomId, team: 'Robotik', ...slot() });
    const res = await request(app)
      .patch(`/reservations/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${anggotaA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('dibatalkan');
  });

  it('anggota B tidak dapat membatalkan reservasi A → 403, tidak ada baris berubah', async () => {
    const created = await create(anggotaA, { roomId, team: 'Robotik', ...slot() });
    const res = await request(app)
      .patch(`/reservations/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${anggotaB.token}`);
    expect(res.status).toBe(403);

    const { data } = await serviceClient(config)
      .from('reservations')
      .select('status')
      .eq('id', created.body.id)
      .single();
    expect(data?.status).toBe('aktif');
  });

  it('RLS: anggota B update langsung via klien anon → 0 baris berubah', async () => {
    const created = await create(anggotaA, { roomId, team: 'Robotik', ...slot() });
    const { data } = await anggotaB.client
      .from('reservations')
      .update({ status: 'dibatalkan' })
      .eq('id', created.body.id)
      .select('id');
    expect(data).toEqual([]);
  });

  it('RLS: pemilik tidak dapat mengubah kolom selain status', async () => {
    const created = await create(anggotaA, { roomId, team: 'Robotik', ...slot() });
    const { error } = await anggotaA.client
      .from('reservations')
      .update({ team: 'Diubah' })
      .eq('id', created.body.id);
    expect(error).not.toBeNull();
  });

  it('admin dapat membatalkan reservasi siapa pun', async () => {
    const created = await create(anggotaA, { roomId, team: 'Robotik', ...slot() });
    const res = await request(app)
      .patch(`/reservations/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('dibatalkan');
  });

  it('id tidak dikenal → 404', async () => {
    const res = await request(app)
      .patch(`/reservations/${crypto.randomUUID()}/cancel`)
      .set('Authorization', `Bearer ${anggotaA.token}`);
    expect(res.status).toBe(404);
  });
});
