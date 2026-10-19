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

const createdItems: string[] = [];

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
  if (createdItems.length > 0) {
    await db.from('equipment').delete().in('id', createdItems);
  }
  await deleteTestUsers(config, [anggotaA, anggotaB, admin, advisor]);
});

function get(path: string, user?: TestUser) {
  const req = request(app).get(path);
  return user ? req.set('Authorization', `Bearer ${user.token}`) : req;
}

function post(path: string, user: TestUser | null, body?: object) {
  const req = request(app).post(path);
  if (user) req.set('Authorization', `Bearer ${user.token}`);
  return req.send(body ?? {});
}

function patch(path: string, user: TestUser | null, body?: object) {
  const req = request(app).patch(path);
  if (user) req.set('Authorization', `Bearer ${user.token}`);
  return req.send(body ?? {});
}

function del(path: string, user?: TestUser) {
  const req = request(app).delete(path);
  return user ? req.set('Authorization', `Bearer ${user.token}`) : req;
}

async function createItem(input: {
  kind?: 'komponen' | 'barang';
  quantity?: number;
  minStock?: number;
}) {
  const name = `Item ${crypto.randomUUID()}`;
  const response = await post('/inventory', admin, {
    name,
    category: 'uji',
    kind: input.kind ?? 'komponen',
    quantity: input.quantity ?? 10,
    minStock: input.minStock ?? 2,
  });
  expect(response.status).toBe(201);
  createdItems.push(response.body.id as string);
  return response.body as { id: string; name: string; quantity: number };
}

describe('GET /inventory', () => {
  it('menghitung flag stok pada batas habis, menipis, dan aman', async () => {
    const habis = await createItem({ quantity: 0, minStock: 5 });
    const menipis = await createItem({ quantity: 5, minStock: 5 });
    const aman = await createItem({ quantity: 6, minStock: 5 });
    const tanpaMin = await createItem({ quantity: 1, minStock: 0 });

    const response = await get('/inventory', anggotaA);
    expect(response.status).toBe(200);
    const byId = new Map(
      (response.body as { id: string; stockFlag: string | null }[]).map((item) => [
        item.id,
        item.stockFlag,
      ]),
    );
    expect(byId.get(habis.id)).toBe('habis');
    expect(byId.get(menipis.id)).toBe('menipis');
    expect(byId.get(aman.id)).toBe('aman');
    expect(byId.get(tanpaMin.id)).toBe('aman');
  });

  it('barang tidak punya flag stok dan selalu satu unit', async () => {
    const item = await createItem({ kind: 'barang', quantity: 5, minStock: 4 });

    const response = await get('/inventory?kind=barang', anggotaA);
    expect(response.status).toBe(200);
    const found = (response.body as { id: string; quantity: number; stockFlag: null }[]).find(
      (row) => row.id === item.id,
    );
    expect(found).toMatchObject({ quantity: 1, stockFlag: null });
  });

  it('memfilter berdasarkan flag dan potongan nama', async () => {
    const unik = `Osilo ${crypto.randomUUID()}`;
    const response = await post('/inventory', admin, {
      name: unik,
      category: 'uji',
      kind: 'komponen',
      quantity: 0,
      minStock: 0,
    });
    expect(response.status).toBe(201);
    createdItems.push(response.body.id as string);

    const filtered = await get('/inventory?flag=habis&q=osilo', anggotaA);
    expect(filtered.status).toBe(200);
    expect((filtered.body as { id: string }[]).map((row) => row.id)).toContain(
      response.body.id as string,
    );

    const none = await get('/inventory?q=zzz-tidak-ada', anggotaA);
    expect(none.status).toBe(200);
    expect(none.body).toEqual([]);
  });

  it('menolak nilai filter yang tidak dikenal', async () => {
    const response = await get('/inventory?kind=alat', anggotaA);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /inventory', () => {
  it('admin membuat komponen dengan jumlah awal dan mencatat riwayat buat', async () => {
    const item = await createItem({ quantity: 7, minStock: 3 });

    const history = await get(`/inventory/${item.id}/history`, admin);
    expect(history.status).toBe(200);
    expect(history.body[0]).toMatchObject({
      action: 'buat',
      beforeQty: null,
      afterQty: 7,
      actorId: admin.id,
    });
  });

  it('memaksa barang menjadi satu unit tanpa min stok', async () => {
    const item = await createItem({ kind: 'barang', quantity: 9, minStock: 9 });
    expect(item).toMatchObject({ quantity: 1 });
  });

  it('menolak nama yang sudah dipakai dengan 409 DUPLICATE_NAME', async () => {
    const item = await createItem({});
    const response = await post('/inventory', admin, {
      name: item.name,
      category: 'uji',
      kind: 'komponen',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DUPLICATE_NAME');
  });

  it('menolak anggota dan advisor, serta tanpa token', async () => {
    const body = { name: `Item ${crypto.randomUUID()}`, category: 'uji', kind: 'komponen' };
    expect((await post('/inventory', anggotaA, body)).status).toBe(403);
    expect((await post('/inventory', advisor, body)).status).toBe(403);
    expect((await post('/inventory', null, body)).status).toBe(401);
  });
});

describe('PATCH /inventory/:id', () => {
  it('mengubah detail item dan mencatat riwayat ubah', async () => {
    const item = await createItem({ quantity: 4 });

    const response = await patch(`/inventory/${item.id}`, admin, {
      name: `${item.name} baru`,
      minStock: 8,
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ minStock: 8, stockFlag: 'menipis' });

    const history = await get(`/inventory/${item.id}/history`, admin);
    expect(history.body[0]).toMatchObject({ action: 'ubah', beforeQty: 4, afterQty: 4 });
  });

  it('menolak perubahan kind', async () => {
    const item = await createItem({});
    const response = await patch(`/inventory/${item.id}`, admin, { kind: 'barang' });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('kind tidak dapat diubah');
  });

  it('menolak anggota dan advisor', async () => {
    const item = await createItem({});
    expect((await patch(`/inventory/${item.id}`, anggotaA, { name: 'x' })).status).toBe(403);
    expect((await patch(`/inventory/${item.id}`, advisor, { name: 'x' })).status).toBe(403);
  });
});

describe('PATCH /inventory/:id/quantity', () => {
  it('menambah lalu mengurangi stok dan mencatat riwayatnya', async () => {
    const item = await createItem({ quantity: 10 });

    const added = await patch(`/inventory/${item.id}/quantity`, admin, {
      mode: 'tambah',
      amount: 5,
      note: 'restok',
    });
    expect(added.status).toBe(200);
    expect(added.body.quantity).toBe(15);

    const history = await get(`/inventory/${item.id}/history`, admin);
    expect(history.body[0]).toMatchObject({
      action: 'tambah',
      beforeQty: 10,
      afterQty: 15,
      note: 'restok',
    });
  });

  it('menolak pengurangan melebihi stok tanpa mengubah jumlah', async () => {
    const item = await createItem({ quantity: 10 });

    const response = await patch(`/inventory/${item.id}/quantity`, admin, {
      mode: 'kurang',
      amount: 999,
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');

    const list = await get('/inventory', admin);
    const row = (list.body as { id: string; quantity: number }[]).find((r) => r.id === item.id);
    expect(row?.quantity).toBe(10);
  });

  it('memakai mode set untuk angka pasti', async () => {
    const item = await createItem({ quantity: 10, minStock: 3 });
    const response = await patch(`/inventory/${item.id}/quantity`, admin, {
      mode: 'set',
      amount: 0,
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ quantity: 0, stockFlag: 'habis' });
  });

  it('menolak item barang', async () => {
    const item = await createItem({ kind: 'barang' });
    const response = await patch(`/inventory/${item.id}/quantity`, admin, {
      mode: 'tambah',
      amount: 1,
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATE');
  });

  it('menjaga stok tetap konsisten saat dua pengurangan bersamaan', async () => {
    const item = await createItem({ quantity: 10 });

    const [first, second] = await Promise.all([
      patch(`/inventory/${item.id}/quantity`, admin, { mode: 'kurang', amount: 6 }),
      patch(`/inventory/${item.id}/quantity`, admin, { mode: 'kurang', amount: 6 }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const list = await get('/inventory', admin);
    const row = (list.body as { id: string; quantity: number }[]).find((r) => r.id === item.id);
    expect(row?.quantity).toBe(4);
  });

  it('menjumlahkan dua penambahan bersamaan', async () => {
    const item = await createItem({ quantity: 10 });

    await Promise.all([
      patch(`/inventory/${item.id}/quantity`, admin, { mode: 'tambah', amount: 5 }),
      patch(`/inventory/${item.id}/quantity`, admin, { mode: 'tambah', amount: 5 }),
    ]);

    const list = await get('/inventory', admin);
    const row = (list.body as { id: string; quantity: number }[]).find((r) => r.id === item.id);
    expect(row?.quantity).toBe(20);
  });

  it('menolak anggota dan advisor', async () => {
    const item = await createItem({});
    const body = { mode: 'tambah', amount: 1 };
    expect((await patch(`/inventory/${item.id}/quantity`, anggotaA, body)).status).toBe(403);
    expect((await patch(`/inventory/${item.id}/quantity`, advisor, body)).status).toBe(403);
  });
});

describe('PATCH /inventory/:id/return', () => {
  it('menandai barang kembali dan mencatat riwayat', async () => {
    const item = await createItem({ kind: 'barang' });
    const db = serviceClient(config);
    const { error } = await db
      .from('equipment')
      .update({
        status: 'dipinjam',
        borrowed_by: anggotaA.id,
        borrowed_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    if (error) throw error;

    const response = await patch(`/inventory/${item.id}/return`, admin);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'tersedia', borrowedBy: null });

    const history = await get(`/inventory/${item.id}/history`, admin);
    expect(history.body[0]).toMatchObject({
      action: 'kembali',
      beforeStatus: 'dipinjam',
      afterStatus: 'tersedia',
    });
  });

  it('menolak item yang tidak sedang dipinjam', async () => {
    const item = await createItem({ kind: 'barang' });
    const response = await patch(`/inventory/${item.id}/return`, admin);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATE');
  });
});

describe('DELETE /inventory/:id', () => {
  it('admin menghapus item beserta riwayatnya', async () => {
    const item = await createItem({});
    const response = await del(`/inventory/${item.id}`, admin);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });

    const list = await get('/inventory', admin);
    expect((list.body as { id: string }[]).some((row) => row.id === item.id)).toBe(false);
  });

  it('menolak penghapusan item yang sedang dipinjam', async () => {
    const item = await createItem({ kind: 'barang' });
    const db = serviceClient(config);
    const { error } = await db
      .from('equipment')
      .update({
        status: 'dipinjam',
        borrowed_by: anggotaA.id,
        borrowed_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    if (error) throw error;

    const response = await del(`/inventory/${item.id}`, admin);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ITEM_ON_LOAN');
  });

  it('menolak penghapusan item yang masih punya permintaan menunggu', async () => {
    const item = await createItem({});
    const db = serviceClient(config);
    const { error } = await db
      .from('component_requests')
      .insert({ item_id: item.id, user_id: anggotaA.id, qty: 1 });
    if (error) throw error;

    const response = await del(`/inventory/${item.id}`, admin);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PENDING_REQUESTS');
  });

  it('menolak anggota dan advisor', async () => {
    const item = await createItem({});
    expect((await del(`/inventory/${item.id}`, anggotaA)).status).toBe(403);
    expect((await del(`/inventory/${item.id}`, advisor)).status).toBe(403);
  });
});

describe('GET /inventory/:id/history', () => {
  it('mengembalikan 404 untuk item yang tidak ada', async () => {
    const response = await get(`/inventory/${crypto.randomUUID()}/history`, anggotaA);
    expect(response.status).toBe(404);
  });

  it('menyertakan nama aktor untuk admin', async () => {
    const item = await createItem({});
    await patch(`/inventory/${item.id}/quantity`, admin, { mode: 'tambah', amount: 1 });

    const response = await get(`/inventory/${item.id}/history`, admin);
    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ action: 'tambah', actorName: 'Test admin' });
  });
});

describe('RLS inventaris', () => {
  it('anggota tidak dapat menulis item langsung lewat klien Supabase', async () => {
    const { error } = await anggotaA.client
      .from('equipment')
      .insert({ name: `RLS ${crypto.randomUUID()}`, category: 'uji', kind: 'komponen' });
    expect(error?.code).toBe('42501');
  });

  it('anggota tidak dapat menulis riwayat item', async () => {
    const item = await createItem({});
    const { error } = await anggotaA.client.from('inventory_history').insert({
      item_id: item.id,
      actor_id: anggotaA.id,
      action: 'tambah',
      after_qty: 1,
    });
    expect(error?.code).toBe('42501');
  });
});
