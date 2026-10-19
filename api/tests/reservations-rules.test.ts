import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { serviceClient } from '../src/supabase.js';
import { createTestUser, deleteTestUsers, testConfig, type TestUser } from './helpers/db.js';

let config: Config;
let app: Express;
let anggota: TestUser;
let roomId: string;

beforeAll(async () => {
  config = testConfig();
  app = createApp(config);
  anggota = await createTestUser(config, 'anggota');
  const { data, error } = await serviceClient(config)
    .from('rooms')
    .insert({ name: `Ruang Aturan ${crypto.randomUUID()}`, kind: 'ruang' })
    .select('id')
    .single();
  if (error) throw error;
  roomId = data.id;
});

afterAll(async () => {
  const db = serviceClient(config);
  await db.from('reservations').delete().eq('room_id', roomId);
  await db.from('rooms').delete().eq('id', roomId);
  if (anggota) await deleteTestUsers(config, [anggota]);
});

let dayOffset = 0;
/** A fresh day per test so reservations never collide by accident. */
function day() {
  dayOffset++;
  return new Date(Date.UTC(2031, 0, 1 + dayOffset)).toISOString().slice(0, 10);
}

function post(startsAt: string, endsAt: string) {
  return request(app)
    .post('/reservations')
    .set('Authorization', `Bearer ${anggota.token}`)
    .send({ roomId, team: 'Robotik', startsAt, endsAt });
}

describe('aturan reservasi', () => {
  it('reservasi kedua yang overlap ditolak 409 CONFLICT', async () => {
    const d = day();
    const first = await post(`${d}T09:00:00+07:00`, `${d}T10:00:00+07:00`);
    expect(first.status).toBe(201);

    const second = await post(`${d}T09:30:00+07:00`, `${d}T10:30:00+07:00`);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
  });

  it('reservasi berdampingan diterima', async () => {
    const d = day();
    expect((await post(`${d}T09:00:00+07:00`, `${d}T10:00:00+07:00`)).status).toBe(201);
    const next = await post(`${d}T10:00:00+07:00`, `${d}T11:00:00+07:00`);
    expect(next.status).toBe(201);
  });

  it('reservasi di luar jam operasional ditolak 422 OUTSIDE_HOURS', async () => {
    const d = day();
    const res = await post(`${d}T20:00:00+07:00`, `${d}T21:30:00+07:00`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('OUTSIDE_HOURS');
  });

  it('input UTC dinilai terhadap WIB: 14:30Z = 21:30 WIB ditolak', async () => {
    const d = day();
    const res = await post(`${d}T13:00:00Z`, `${d}T14:30:00Z`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('OUTSIDE_HOURS');
  });

  it('reservasi yang dibatalkan tidak memblokir slot', async () => {
    const d = day();
    const first = await post(`${d}T09:00:00+07:00`, `${d}T10:00:00+07:00`);
    expect(first.status).toBe(201);
    const cancel = await request(app)
      .patch(`/reservations/${first.body.id}/cancel`)
      .set('Authorization', `Bearer ${anggota.token}`);
    expect(cancel.status).toBe(200);

    const again = await post(`${d}T09:00:00+07:00`, `${d}T10:00:00+07:00`);
    expect(again.status).toBe(201);
  });

  it('constraint DB menolak overlap walau pre-check aplikasi dilewati', async () => {
    const d = day();
    const first = await post(`${d}T09:00:00+07:00`, `${d}T10:00:00+07:00`);
    expect(first.status).toBe(201);

    // Insert langsung lewat klien ber-JWT: tanpa pre-check aplikasi.
    const { error } = await anggota.client.from('reservations').insert({
      room_id: roomId,
      team: 'Robotik',
      user_id: anggota.id,
      starts_at: `${d}T09:15:00+07:00`,
      ends_at: `${d}T09:45:00+07:00`,
    });
    expect(error?.code).toBe('23P01');
  });
});
