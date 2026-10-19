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
  if (ids.length > 0) await db.from('facility_reports').delete().in('reported_by', ids);
  await deleteTestUsers(config, [anggotaA, anggotaB, admin, advisor].filter(Boolean));
});

function createReport(user: TestUser, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/facility-reports')
    .set('Authorization', `Bearer ${user.token}`)
    .send({
      category: 'lampu',
      description: 'Lampu ruang utama mati',
      location: 'Ruang Robotik A',
      ...overrides,
    });
}

function setStatus(user: TestUser, id: string, status: string) {
  return request(app)
    .patch(`/facility-reports/${id}/status`)
    .set('Authorization', `Bearer ${user.token}`)
    .send({ status });
}

describe('POST /facility-reports', () => {
  it('anggota membuat laporan dengan status baru', async () => {
    const res = await createReport(anggotaA);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      category: 'lampu',
      status: 'baru',
      reportedBy: anggotaA.id,
    });
  });

  it('deskripsi 4 karakter → 400', async () => {
    const res = await createReport(anggotaA, { description: 'mati' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('kategori tidak dikenal → 400', async () => {
    const res = await createReport(anggotaA, { category: 'atap' });
    expect(res.status).toBe(400);
  });

  it('lokasi kosong → 400', async () => {
    const res = await createReport(anggotaA, { location: '   ' });
    expect(res.status).toBe(400);
  });

  it('advisor tidak dapat membuat laporan → 403', async () => {
    const res = await createReport(advisor);
    expect(res.status).toBe(403);
  });
});

describe('GET /facility-reports', () => {
  it('anggota hanya melihat laporannya sendiri', async () => {
    const mine = await createReport(anggotaA, { description: 'Ventilasi berbunyi' });
    const res = await request(app)
      .get('/facility-reports')
      .set('Authorization', `Bearer ${anggotaB.token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((row: { id: string }) => row.id)).not.toContain(mine.body.id);
  });

  it('advisor melihat semua laporan', async () => {
    const mine = await createReport(anggotaA, { description: 'Kabel terkelupas' });
    const res = await request(app)
      .get('/facility-reports')
      .set('Authorization', `Bearer ${advisor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((row: { id: string }) => row.id)).toContain(mine.body.id);
  });
});

describe('PATCH /facility-reports/:id/status', () => {
  it('alur baru → ditindaklanjuti → selesai', async () => {
    const created = await createReport(anggotaA);
    const first = await setStatus(admin, created.body.id, 'ditindaklanjuti');
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('ditindaklanjuti');

    const second = await setStatus(admin, created.body.id, 'selesai');
    expect(second.status).toBe(200);
    expect(second.body.status).toBe('selesai');
  });

  it('baru → selesai → 422 INVALID_TRANSITION', async () => {
    const created = await createReport(anggotaA);
    const res = await setStatus(admin, created.body.id, 'selesai');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('anggota tidak dapat mengubah status → 403', async () => {
    const created = await createReport(anggotaA);
    const res = await setStatus(anggotaA, created.body.id, 'ditindaklanjuti');
    expect(res.status).toBe(403);
  });

  it('status tidak dikenal → 400', async () => {
    const created = await createReport(anggotaA);
    const res = await setStatus(admin, created.body.id, 'selesaii');
    expect(res.status).toBe(400);
  });

  it('laporan tidak dikenal → 404', async () => {
    const res = await setStatus(admin, crypto.randomUUID(), 'ditindaklanjuti');
    expect(res.status).toBe(404);
  });

  it('trigger SQL menolak transisi tidak sah walau API dilewati', async () => {
    const created = await createReport(anggotaA);
    const { error } = await admin.client
      .from('facility_reports')
      .update({ status: 'selesai' })
      .eq('id', created.body.id);
    expect(error?.code).toBe('P0001');
  });
});

describe('RLS facility_reports', () => {
  it('anggota B tidak dapat mengubah status laporan A', async () => {
    const created = await createReport(anggotaA);
    const { data } = await anggotaB.client
      .from('facility_reports')
      .update({ status: 'ditindaklanjuti' })
      .eq('id', created.body.id)
      .select('id');
    expect(data).toEqual([]);
  });

  it('anggota tidak dapat membuat laporan atas nama orang lain', async () => {
    const { error } = await anggotaA.client.from('facility_reports').insert({
      category: 'lampu',
      description: 'Laporan palsu',
      location: 'Ruang',
      reported_by: anggotaB.id,
    });
    expect(error?.code).toBe('42501');
  });
});
