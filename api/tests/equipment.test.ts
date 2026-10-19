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

async function createEquipment(totalQty: number) {
  const { data, error } = await serviceClient(config)
    .from('equipment')
    .insert({ name: `Alat ${crypto.randomUUID()}`, category: 'sensor', total_qty: totalQty })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

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
  if (ids.length > 0) {
    await db.from('equipment_loans').delete().in('user_id', ids);
    await db.from('equipment').delete().like('name', 'Alat %');
  }
  await deleteTestUsers(config, [anggotaA, anggotaB, admin, advisor].filter(Boolean));
});

function post(path: string, user: TestUser, body?: object) {
  const req = request(app).post(path).set('Authorization', `Bearer ${user.token}`);
  return body ? req.send(body) : req;
}

describe('GET /equipment', () => {
  it('menampilkan total dan jumlah tersedia', async () => {
    const id = await createEquipment(5);
    await post(`/equipment/${id}/loans`, anggotaA, { qty: 2 });

    const res = await request(app)
      .get('/equipment')
      .set('Authorization', `Bearer ${advisor.token}`);
    expect(res.status).toBe(200);
    const row = res.body.find((item: { id: string }) => item.id === id);
    expect(row).toMatchObject({ totalQty: 5, available: 3 });
  });
});

describe('POST /equipment', () => {
  it('admin dapat menambah alat', async () => {
    const res = await post('/equipment', admin, {
      name: `Alat ${crypto.randomUUID()}`,
      category: 'aktuator',
      totalQty: 2,
    });
    expect(res.status).toBe(201);
    expect(res.body.totalQty).toBe(2);
  });

  it('anggota → 403', async () => {
    const res = await post('/equipment', anggotaA, {
      name: `Alat ${crypto.randomUUID()}`,
      category: 'aktuator',
      totalQty: 2,
    });
    expect(res.status).toBe(403);
  });

  it('totalQty negatif → 400', async () => {
    const res = await post('/equipment', admin, {
      name: `Alat ${crypto.randomUUID()}`,
      category: 'aktuator',
      totalQty: -1,
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /equipment/:id/loans', () => {
  it('pinjam melebihi stok → 409 INSUFFICIENT_STOCK', async () => {
    const id = await createEquipment(2);
    const res = await post(`/equipment/${id}/loans`, anggotaA, { qty: 3 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('dua pinjaman paralel untuk sisa 1: tepat satu sukses', async () => {
    const id = await createEquipment(1);
    const results = await Promise.all([
      post(`/equipment/${id}/loans`, anggotaA, { qty: 1 }),
      post(`/equipment/${id}/loans`, anggotaB, { qty: 1 }),
    ]);
    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 409]);

    const { count } = await serviceClient(config)
      .from('equipment_loans')
      .select('id', { count: 'exact', head: true })
      .eq('equipment_id', id)
      .is('returned_at', null);
    expect(count).toBe(1);
  });

  it('qty 0 → 400', async () => {
    const id = await createEquipment(3);
    const res = await post(`/equipment/${id}/loans`, anggotaA, { qty: 0 });
    expect(res.status).toBe(400);
  });

  it('alat tidak dikenal → 404', async () => {
    const res = await post(`/equipment/${crypto.randomUUID()}/loans`, anggotaA, { qty: 1 });
    expect(res.status).toBe(404);
  });

  it('advisor tidak dapat meminjam → 403', async () => {
    const id = await createEquipment(3);
    const res = await post(`/equipment/${id}/loans`, advisor, { qty: 1 });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /equipment/loans/:loanId/return', () => {
  it('peminjam dapat mengembalikan, stok kembali', async () => {
    const id = await createEquipment(2);
    const loan = await post(`/equipment/${id}/loans`, anggotaA, { qty: 2 });
    expect(loan.status).toBe(201);

    const res = await request(app)
      .patch(`/equipment/loans/${loan.body.id}/return`)
      .set('Authorization', `Bearer ${anggotaA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.returnedAt).not.toBeNull();

    const list = await request(app)
      .get('/equipment')
      .set('Authorization', `Bearer ${anggotaA.token}`);
    expect(list.body.find((item: { id: string }) => item.id === id).available).toBe(2);
  });

  it('anggota lain tidak dapat mengembalikan pinjaman (404, RLS menyembunyikan baris)', async () => {
    const id = await createEquipment(2);
    const loan = await post(`/equipment/${id}/loans`, anggotaA, { qty: 1 });
    const res = await request(app)
      .patch(`/equipment/loans/${loan.body.id}/return`)
      .set('Authorization', `Bearer ${anggotaB.token}`);
    expect(res.status).toBe(404);

    const { data } = await serviceClient(config)
      .from('equipment_loans')
      .select('returned_at')
      .eq('id', loan.body.id)
      .single();
    expect(data?.returned_at).toBeNull();
  });

  it('mengembalikan dua kali → 409 ALREADY_RETURNED', async () => {
    const id = await createEquipment(1);
    const loan = await post(`/equipment/${id}/loans`, anggotaA, { qty: 1 });
    await request(app)
      .patch(`/equipment/loans/${loan.body.id}/return`)
      .set('Authorization', `Bearer ${anggotaA.token}`);
    const second = await request(app)
      .patch(`/equipment/loans/${loan.body.id}/return`)
      .set('Authorization', `Bearer ${anggotaA.token}`);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_RETURNED');
  });
});

describe('RLS equipment', () => {
  it('anggota A tidak dapat membaca pinjaman anggota B', async () => {
    const id = await createEquipment(2);
    await post(`/equipment/${id}/loans`, anggotaB, { qty: 1 });
    const { data } = await anggotaA.client
      .from('equipment_loans')
      .select('id')
      .eq('equipment_id', id);
    expect(data).toEqual([]);
  });

  it('anggota tidak dapat menambah alat lewat klien anon', async () => {
    const { error } = await anggotaA.client
      .from('equipment')
      .insert({ name: `Alat ${crypto.randomUUID()}`, category: 'x', total_qty: 1 });
    expect(error?.code).toBe('42501');
  });
});
