import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requireAuth, requireRole, supabaseVerifier } from '../../src/auth/requireAuth.js';
import type { Config } from '../../src/config.js';
import { serviceClient } from '../../src/supabase.js';
import { createTestUser, deleteTestUsers, testConfig, type TestUser } from '../helpers/db.js';

let config: Config;
let anggotaA: TestUser;
let anggotaB: TestUser;
let admin: TestUser;

beforeAll(async () => {
  config = testConfig();
  [anggotaA, anggotaB, admin] = await Promise.all([
    createTestUser(config, 'anggota'),
    createTestUser(config, 'anggota'),
    createTestUser(config, 'admin'),
  ]);
});

afterAll(async () => {
  await deleteTestUsers(config, [anggotaA, anggotaB, admin].filter(Boolean));
});

describe('profiles RLS', () => {
  it('user baru otomatis berperan anggota', async () => {
    const { data } = await serviceClient(config)
      .from('profiles')
      .select('role, full_name')
      .eq('id', anggotaA.id)
      .single();
    expect(data).toEqual({ role: 'anggota', full_name: 'Test anggota' });
  });

  it('anggota A tidak dapat membaca profil anggota B', async () => {
    const { data, error } = await anggotaA.client
      .from('profiles')
      .select('id')
      .eq('id', anggotaB.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('anggota hanya melihat profilnya sendiri', async () => {
    const { data } = await anggotaA.client.from('profiles').select('id');
    expect(data).toEqual([{ id: anggotaA.id }]);
  });

  it('admin dapat membaca semua profil', async () => {
    const { data } = await admin.client
      .from('profiles')
      .select('id')
      .in('id', [anggotaA.id, anggotaB.id]);
    expect(data?.map((p) => p.id).sort()).toEqual([anggotaA.id, anggotaB.id].sort());
  });

  it('anggota tidak dapat mengubah role miliknya', async () => {
    await anggotaA.client.from('profiles').update({ role: 'admin' }).eq('id', anggotaA.id);
    const { data } = await serviceClient(config)
      .from('profiles')
      .select('role')
      .eq('id', anggotaA.id)
      .single();
    expect(data?.role).toBe('anggota');
  });

  it('anggota dapat mengubah full_name miliknya', async () => {
    const { error } = await anggotaA.client
      .from('profiles')
      .update({ full_name: 'Nama Baru' })
      .eq('id', anggotaA.id);
    expect(error).toBeNull();
    const { data } = await serviceClient(config)
      .from('profiles')
      .select('full_name')
      .eq('id', anggotaA.id)
      .single();
    expect(data?.full_name).toBe('Nama Baru');
  });

  it('anggota A tidak dapat mengubah full_name anggota B', async () => {
    await anggotaA.client.from('profiles').update({ full_name: 'Dibajak' }).eq('id', anggotaB.id);
    const { data } = await serviceClient(config)
      .from('profiles')
      .select('full_name')
      .eq('id', anggotaB.id)
      .single();
    expect(data?.full_name).toBe('Test anggota');
  });

  it('anggota tidak dapat menghapus profil', async () => {
    await anggotaA.client.from('profiles').delete().eq('id', anggotaA.id);
    const { count } = await serviceClient(config)
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('id', anggotaA.id);
    expect(count).toBe(1);
  });
});

describe('supabaseVerifier dengan token nyata', () => {
  const app = express();

  beforeAll(() => {
    app.get(
      '/admin-only',
      requireAuth(supabaseVerifier(config)),
      requireRole('admin'),
      (req, res) => {
        res.json(req.user);
      },
    );
  });

  it('token admin → 200 dengan role admin', async () => {
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: admin.id, role: 'admin' });
  });

  it('token anggota → 403', async () => {
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${anggotaA.token}`);
    expect(res.status).toBe(403);
  });

  it('token rusak → 401', async () => {
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', 'Bearer bukan.jwt.valid');
    expect(res.status).toBe(401);
  });
});
