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
  if (createdItems.length > 0) await db.from('equipment').delete().in('id', createdItems);
  await deleteTestUsers(config, [anggotaA, anggotaB, admin, advisor]);
});

function call(
  method: 'get' | 'post' | 'patch',
  path: string,
  user?: TestUser | null,
  body?: object,
) {
  const req = request(app)[method](path);
  if (user) req.set('Authorization', `Bearer ${user.token}`);
  return req.send(body ?? {});
}

async function createItem(kind: 'komponen' | 'barang', quantity = 10) {
  const { data, error } = await serviceClient(config)
    .from('equipment')
    .insert({
      name: `Item ${crypto.randomUUID()}`,
      category: 'uji',
      kind,
      quantity: kind === 'barang' ? 1 : quantity,
      min_stock: 0,
    })
    .select('id, name')
    .single();
  if (error) throw error;
  createdItems.push(data.id as string);
  return data as { id: string; name: string };
}

async function itemStatus(id: string) {
  const { data, error } = await serviceClient(config)
    .from('equipment')
    .select('quantity, status, borrowed_by')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as { quantity: number; status: string; borrowed_by: string | null };
}

async function notificationsFor(user: TestUser) {
  const { data, error } = await serviceClient(config)
    .from('notifications')
    .select('kind, message, created_at')
    .eq('user_id', user.id)
    .order('created_at');
  if (error) throw error;
  return data as { kind: string; message: string; created_at: string }[];
}

describe('POST /component-requests', () => {
  it('anggota membuat laporan ambil dengan user_id dari token', async () => {
    const item = await createItem('komponen', 10);

    const response = await call('post', '/component-requests', anggotaA, {
      itemId: item.id,
      qty: 2,
      note: 'untuk proyek',
      user_id: anggotaB.id,
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      itemId: item.id,
      itemName: item.name,
      userId: anggotaA.id,
      qty: 2,
      status: 'menunggu',
      note: 'untuk proyek',
    });
  });

  it('menolak item yang bukan komponen', async () => {
    const item = await createItem('barang');
    const response = await call('post', '/component-requests', anggotaA, {
      itemId: item.id,
      qty: 1,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('NOT_COMPONENT');
  });

  it('menolak qty nol atau negatif dan qty melebihi stok', async () => {
    const item = await createItem('komponen', 3);

    for (const qty of [0, -1]) {
      const response = await call('post', '/component-requests', anggotaA, {
        itemId: item.id,
        qty,
      });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const tooMany = await call('post', '/component-requests', anggotaA, {
      itemId: item.id,
      qty: 4,
    });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('menolak advisor dan tanpa token', async () => {
    const item = await createItem('komponen', 3);
    expect(
      (await call('post', '/component-requests', advisor, { itemId: item.id, qty: 1 })).status,
    ).toBe(403);
    expect(
      (await call('post', '/component-requests', null, { itemId: item.id, qty: 1 })).status,
    ).toBe(401);
  });

  it('anggota tidak dapat menyisipkan permintaan atas nama orang lain lewat klien Supabase', async () => {
    const item = await createItem('komponen', 3);
    const { error } = await anggotaA.client.from('component_requests').insert({
      item_id: item.id,
      user_id: anggotaB.id,
      qty: 1,
    });
    expect(error?.code).toBe('42501');
  });

  it('memberi notifikasi inventaris ke setiap admin', async () => {
    const item = await createItem('komponen', 5);
    const before = (await notificationsFor(admin)).length;

    const response = await call('post', '/component-requests', anggotaA, {
      itemId: item.id,
      qty: 1,
    });
    expect(response.status).toBe(201);

    const after = await notificationsFor(admin);
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)?.kind).toBe('inventaris');
    expect(after.at(-1)?.message).toContain(item.name);
  });
});

describe('GET /component-requests', () => {
  it('anggota hanya melihat miliknya sendiri, admin melihat semua', async () => {
    const item = await createItem('komponen', 10);
    const created = await call('post', '/component-requests', anggotaA, {
      itemId: item.id,
      qty: 1,
    });
    expect(created.status).toBe(201);

    const own = await call('get', '/component-requests', anggotaA);
    expect(own.status).toBe(200);
    expect((own.body as { id: string }[]).map((row) => row.id)).toContain(
      created.body.id as string,
    );

    const other = await call('get', '/component-requests', anggotaB);
    expect(other.status).toBe(200);
    expect((other.body as { id: string }[]).map((row) => row.id)).not.toContain(
      created.body.id as string,
    );

    const all = await call('get', '/component-requests', admin);
    expect((all.body as { id: string }[]).map((row) => row.id)).toContain(
      created.body.id as string,
    );
  });
});

describe('keputusan admin atas laporan ambil', () => {
  it('anggota tidak boleh mengonfirmasi', async () => {
    const item = await createItem('komponen', 5);
    const created = await call('post', '/component-requests', anggotaA, {
      itemId: item.id,
      qty: 1,
    });
    const response = await call(
      'patch',
      `/component-requests/${created.body.id}/confirm`,
      anggotaA,
    );
    expect(response.status).toBe(403);
  });

  it('konfirmasi mengurangi stok tepat sekali dan memberi notifikasi ke pemohon', async () => {
    const item = await createItem('komponen', 10);
    const created = await call('post', '/component-requests', anggotaA, {
      itemId: item.id,
      qty: 4,
    });

    const response = await call('patch', `/component-requests/${created.body.id}/confirm`, admin);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'dikonfirmasi', decidedBy: admin.id });
    expect((await itemStatus(item.id)).quantity).toBe(6);

    const second = await call('patch', `/component-requests/${created.body.id}/confirm`, admin);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVALID_STATE');
    expect((await itemStatus(item.id)).quantity).toBe(6);

    const notifications = await notificationsFor(anggotaA);
    expect(notifications.at(-1)).toMatchObject({ kind: 'inventaris' });
    expect(notifications.at(-1)?.message).toContain(item.name);
  });

  it('menolak konfirmasi saat stok sudah turun di bawah qty', async () => {
    const item = await createItem('komponen', 5);
    const created = await call('post', '/component-requests', anggotaA, {
      itemId: item.id,
      qty: 5,
    });

    const db = serviceClient(config);
    const { error } = await db.from('equipment').update({ quantity: 1 }).eq('id', item.id);
    if (error) throw error;

    const response = await call('patch', `/component-requests/${created.body.id}/confirm`, admin);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect((await itemStatus(item.id)).quantity).toBe(1);
  });

  it('admin menolak laporan dengan catatan, lalu konfirmasi ulang ditolak', async () => {
    const item = await createItem('komponen', 5);
    const created = await call('post', '/component-requests', anggotaA, {
      itemId: item.id,
      qty: 2,
    });

    const response = await call('patch', `/component-requests/${created.body.id}/reject`, admin, {
      note: 'stok dialihkan',
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ditolak', adminNote: 'stok dialihkan' });
    expect((await itemStatus(item.id)).quantity).toBe(5);

    const again = await call('patch', `/component-requests/${created.body.id}/reject`, admin, {});
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_STATE');
  });

  it('admin menandai laporan sudah dibaca', async () => {
    const item = await createItem('komponen', 5);
    const created = await call('post', '/component-requests', anggotaA, {
      itemId: item.id,
      qty: 1,
    });
    expect(created.body.adminReadAt).toBeNull();

    const response = await call('patch', `/component-requests/${created.body.id}/read`, admin);
    expect(response.status).toBe(200);
    expect(response.body.adminReadAt).not.toBeNull();

    expect(
      (await call('patch', `/component-requests/${created.body.id}/read`, anggotaA)).status,
    ).toBe(403);
  });
});

describe('POST /loan-requests', () => {
  it('anggota mengajukan pinjam barang yang tersedia', async () => {
    const item = await createItem('barang');
    const response = await call('post', '/loan-requests', anggotaA, {
      itemId: item.id,
      purpose: 'kalibrasi sensor',
      expectedReturnAt: '2026-11-01',
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      itemId: item.id,
      userId: anggotaA.id,
      purpose: 'kalibrasi sensor',
      expectedReturnAt: '2026-11-01',
      status: 'menunggu',
    });
  });

  it('menolak barang yang sedang dipinjam', async () => {
    const item = await createItem('barang');
    const db = serviceClient(config);
    const { error } = await db
      .from('equipment')
      .update({
        status: 'dipinjam',
        borrowed_by: anggotaB.id,
        borrowed_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    if (error) throw error;

    const response = await call('post', '/loan-requests', anggotaA, {
      itemId: item.id,
      purpose: 'butuh untuk praktikum',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ITEM_UNAVAILABLE');
  });

  it('menolak komponen dan keperluan yang terlalu pendek', async () => {
    const komponen = await createItem('komponen', 5);
    const notBarang = await call('post', '/loan-requests', anggotaA, {
      itemId: komponen.id,
      purpose: 'percobaan',
    });
    expect(notBarang.status).toBe(400);
    expect(notBarang.body.error.code).toBe('NOT_BARANG');

    const barang = await createItem('barang');
    const tooShort = await call('post', '/loan-requests', anggotaA, {
      itemId: barang.id,
      purpose: 'ok',
    });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('menolak advisor', async () => {
    const item = await createItem('barang');
    const response = await call('post', '/loan-requests', advisor, {
      itemId: item.id,
      purpose: 'melihat alat',
    });
    expect(response.status).toBe(403);
  });
});

describe('PATCH /loan-requests/:id/approve', () => {
  it('menyetujui tepat sekali saat dua permintaan bersamaan', async () => {
    const item = await createItem('barang');
    const created = await call('post', '/loan-requests', anggotaA, {
      itemId: item.id,
      purpose: 'praktikum mingguan',
    });

    const [first, second] = await Promise.all([
      call('patch', `/loan-requests/${created.body.id}/approve`, admin),
      call('patch', `/loan-requests/${created.body.id}/approve`, admin),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);

    expect(await itemStatus(item.id)).toMatchObject({
      status: 'dipinjam',
      borrowed_by: anggotaA.id,
    });
  });

  it('menolak permintaan lain untuk item yang sama dengan catatan otomatis', async () => {
    const item = await createItem('barang');
    const first = await call('post', '/loan-requests', anggotaA, {
      itemId: item.id,
      purpose: 'keperluan pertama',
    });
    const second = await call('post', '/loan-requests', anggotaB, {
      itemId: item.id,
      purpose: 'keperluan kedua',
    });

    const approved = await call('patch', `/loan-requests/${first.body.id}/approve`, admin);
    expect(approved.status).toBe(200);

    const { data, error } = await serviceClient(config)
      .from('loan_requests')
      .select('status, admin_note')
      .eq('id', second.body.id)
      .single();
    if (error) throw error;
    expect(data).toMatchObject({ status: 'ditolak', admin_note: 'barang sudah dipinjam' });
  });

  it('menolak anggota dan permintaan yang sudah diputuskan', async () => {
    const item = await createItem('barang');
    const created = await call('post', '/loan-requests', anggotaA, {
      itemId: item.id,
      purpose: 'keperluan uji',
    });

    expect(
      (await call('patch', `/loan-requests/${created.body.id}/approve`, anggotaA)).status,
    ).toBe(403);

    expect((await call('patch', `/loan-requests/${created.body.id}/approve`, admin)).status).toBe(
      200,
    );
    const again = await call('patch', `/loan-requests/${created.body.id}/approve`, admin);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_STATE');
  });
});

describe('PATCH /loan-requests/:id/reject', () => {
  it('admin menolak dengan catatan', async () => {
    const item = await createItem('barang');
    const created = await call('post', '/loan-requests', anggotaA, {
      itemId: item.id,
      purpose: 'keperluan uji',
    });

    const response = await call('patch', `/loan-requests/${created.body.id}/reject`, admin, {
      note: 'dipakai lomba',
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ditolak', adminNote: 'dipakai lomba' });
    expect((await itemStatus(item.id)).status).toBe('tersedia');
  });
});

describe('PATCH /loan-requests/:id/cancel', () => {
  it('pemilik membatalkan selama menunggu', async () => {
    const item = await createItem('barang');
    const created = await call('post', '/loan-requests', anggotaA, {
      itemId: item.id,
      purpose: 'keperluan uji',
    });

    const response = await call('patch', `/loan-requests/${created.body.id}/cancel`, anggotaA);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('dibatalkan');
  });

  it('menolak pembatalan setelah disetujui dan oleh anggota lain', async () => {
    const item = await createItem('barang');
    const created = await call('post', '/loan-requests', anggotaA, {
      itemId: item.id,
      purpose: 'keperluan uji',
    });

    const other = await call('patch', `/loan-requests/${created.body.id}/cancel`, anggotaB);
    expect(other.status).toBe(403);

    expect((await call('patch', `/loan-requests/${created.body.id}/approve`, admin)).status).toBe(
      200,
    );
    const afterApproval = await call('patch', `/loan-requests/${created.body.id}/cancel`, anggotaA);
    expect(afterApproval.status).toBe(409);
    expect(afterApproval.body.error.code).toBe('INVALID_STATE');
  });
});

describe('GET /inventory/pending-count', () => {
  it('admin melihat jumlah permintaan menunggu, anggota ditolak', async () => {
    const before = await call('get', '/inventory/pending-count', admin);
    expect(before.status).toBe(200);

    const komponen = await createItem('komponen', 5);
    const barang = await createItem('barang');
    await call('post', '/component-requests', anggotaA, { itemId: komponen.id, qty: 1 });
    await call('post', '/loan-requests', anggotaA, {
      itemId: barang.id,
      purpose: 'keperluan uji',
    });

    const after = await call('get', '/inventory/pending-count', admin);
    expect(after.status).toBe(200);
    expect(after.body.componentRequests).toBe(before.body.componentRequests + 1);
    expect(after.body.loanRequests).toBe(before.body.loanRequests + 1);
    expect(after.body.total).toBe(after.body.componentRequests + after.body.loanRequests);

    expect((await call('get', '/inventory/pending-count', anggotaA)).status).toBe(403);
  });
});
