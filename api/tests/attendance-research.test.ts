import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { getPeriod } from '../src/attendance/summary.js';
import type { Config } from '../src/config.js';
import { serviceClient } from '../src/supabase.js';
import { createTestUser, deleteTestUsers, testConfig, type TestUser } from './helpers/db.js';

let config: Config;
let app: Express;
let member: TestUser;
let other: TestUser;
let admin: TestUser;
let advisor: TestUser;
let settings: Record<string, unknown> | null;
let openId: string;
const historical = '?date=2025-01-01';

beforeAll(async () => {
  config = testConfig();
  app = createApp(config);
  [member, other, admin, advisor] = await Promise.all([
    createTestUser(config, 'anggota'),
    createTestUser(config, 'anggota'),
    createTestUser(config, 'admin'),
    createTestUser(config, 'advisor'),
  ]);
  const db = serviceClient(config);
  const snapshot = await db.from('attendance_settings').select('*').eq('id', true).maybeSingle();
  settings = snapshot.data;
  const { data, error } = await db
    .from('attendance')
    .insert([
      {
        user_id: member.id,
        checked_in_at: '2024-12-31T16:30:00Z',
        checked_out_at: '2024-12-31T18:00:00Z',
      },
      {
        user_id: member.id,
        checked_in_at: '2025-01-01T01:00:00Z',
        checked_out_at: '2025-01-01T09:30:00Z',
      },
      { user_id: other.id, checked_in_at: new Date(Date.now() - 90 * 60_000).toISOString() },
    ])
    .select('id,user_id');
  if (error) throw error;
  openId = data.find((row) => row.user_id === other.id)!.id;
});

afterAll(async () => {
  const users = [member, other, admin, advisor].filter(Boolean);
  const db = serviceClient(config);
  const ids = users.map((user) => user.id);
  for (const table of [
    'attendance_corrections',
    'attendance_warnings',
    'attendance',
    'notifications',
  ]) {
    await db.from(table).delete().in('user_id', ids);
  }
  if (settings) {
    const { error } = await db.from('attendance_settings').update(settings).eq('id', true);
    if (error) throw error;
  }
  await deleteTestUsers(config, users);
});

function get(user: TestUser, path: string) {
  return request(app).get(path).set('Authorization', `Bearer ${user.token}`);
}

describe('API absensi riset', () => {
  it('mewajibkan autentikasi', async () => {
    expect((await request(app).get('/attendance/summary')).status).toBe(401);
  });

  it('admin mengatur target dengan identitas audit dari JWT', async () => {
    const res = await request(app)
      .put('/attendance/target')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ weeklyTargetMinutes: 600 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ weeklyTargetMinutes: 600, updatedBy: admin.id });
    expect((await get(member, '/attendance/target')).body.weeklyTargetMinutes).toBe(600);
  });

  it.each(['anggota', 'advisor'] as const)('%s tidak dapat mengatur target', async (role) => {
    const user = role === 'anggota' ? member : advisor;
    expect(
      (
        await request(app)
          .put('/attendance/target')
          .set('Authorization', `Bearer ${user.token}`)
          .send({ weeklyTargetMinutes: 0 })
      ).status,
    ).toBe(403);
  });

  it.each([-1, 10081, 1.5, '600', null])('menolak target tidak valid %s', async (value) => {
    expect(
      (
        await request(app)
          .put('/attendance/target')
          .set('Authorization', `Bearer ${admin.token}`)
          .send({ weeklyTargetMinutes: value })
      ).status,
    ).toBe(400);
  });

  it('rekap mingguan pribadi tepat target dan membagi tengah malam WIB', async () => {
    const res = await get(member, `/attendance/summary${historical}`);
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0]).toMatchObject({
      userId: member.id,
      totalMinutes: 600,
      sessionCount: 2,
      status: 'TERCAPAI',
      daysPresent: 2,
      elapsedDays: 7,
      overNightSessionCount: 1,
      overNightSessionRatio: 0.5,
    });
    expect(
      res.body.members[0].days.find((day: { date: string }) => day.date === '2024-12-31').minutes,
    ).toBe(30);
    expect(res.body.members[0].attendanceRate).toBeCloseTo(2 / 7);
  });

  it('bulan Januari hanya menghitung bagian Januari dan prorata target', async () => {
    const res = await get(member, '/attendance/summary?period=month&date=2025-01-01');
    expect(res.status).toBe(200);
    expect(res.body.members[0]).toMatchObject({ totalMinutes: 570, status: 'KURANG' });
    expect(res.body.targetMinutes).toBeCloseTo((600 * 31) / 7);
  });

  it.each(['summary', 'warnings', 'corrections'])(
    'anggota tidak dapat membaca %s orang lain',
    async (path) => {
      expect((await get(member, `/attendance/${path}?userId=${other.id}`)).status).toBe(403);
    },
  );

  it.each(['admin', 'advisor'] as const)(
    '%s melihat rekap seluruh anggota dan dapat memfilter',
    async (role) => {
      const user = role === 'admin' ? admin : advisor;
      const all = await get(user, `/attendance/summary${historical}`);
      expect(all.status).toBe(200);
      expect(all.body.members.map((row: { userId: string }) => row.userId)).toEqual(
        expect.arrayContaining([member.id, other.id]),
      );
      expect(all.body.members.some((row: { userId: string }) => row.userId === admin.id)).toBe(
        false,
      );
      const one = await get(user, `/attendance/summary${historical}&userId=${member.id}`);
      expect(one.body.members).toHaveLength(1);
      expect(one.body.members[0].userId).toBe(member.id);
    },
  );

  it.each(['period=year', 'date=2025-02-29', 'date=bad', 'period=week&period=month', 'userId=bad'])(
    'menolak query rekap invalid %s',
    async (query) => {
      expect((await get(member, `/attendance/summary?${query}`)).status).toBe(400);
    },
  );

  it('rekap melewati batas 1000 baris PostgREST', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: randomUUID(),
      user_id: other.id,
      checked_in_at: new Date(Date.UTC(2025, 0, 2) + index * 60_000).toISOString(),
      checked_out_at: new Date(Date.UTC(2025, 0, 2) + (index + 1) * 60_000).toISOString(),
    }));
    const { error } = await serviceClient(config).from('attendance').insert(rows);
    expect(error).toBeNull();
    const res = await get(other, `/attendance/summary${historical}`);
    expect(res.status).toBe(200);
    expect(res.body.members[0]).toMatchObject({ sessionCount: 1001, totalMinutes: 1001 });
  });

  it('statistik admin menghitung agregat serta tren minggu lintas tahun', async () => {
    const res = await get(admin, '/attendance/statistics?date=2025-01-01&weeks=2');
    expect(res.status).toBe(200);
    expect(res.body.trend).toHaveLength(2);
    expect(res.body.trend[0].period.days[0]).toBe('2024-12-23');
    expect(res.body.trend[1].period.days[0]).toBe('2024-12-30');
    const total = res.body.members.reduce(
      (sum: number, row: { totalMinutes: number }) => sum + row.totalMinutes,
      0,
    );
    expect(res.body.aggregate.totalMinutes).toBe(total);
    expect(res.body.aggregate.memberCount).toBe(res.body.members.length);
    expect(res.body.aggregate.averageWeeklyHours).toBeCloseTo(total / 60 / res.body.members.length);
  });

  it.each(['anggota', 'advisor'] as const)(
    '%s tidak dapat membaca statistik admin',
    async (role) => {
      expect(
        (await get(role === 'anggota' ? member : advisor, '/attendance/statistics')).status,
      ).toBe(403);
    },
  );

  it.each(['0', '53', '1.5', 'bad'])('menolak jumlah minggu %s', async (weeks) => {
    expect((await get(admin, `/attendance/statistics?weeks=${weeks}`)).status).toBe(400);
  });

  it('advisor mengirim satu peringatan per hari, tersimpan dan masuk notifikasi', async () => {
    const send = () =>
      request(app)
        .post('/attendance/warnings')
        .set('Authorization', `Bearer ${advisor.token}`)
        .send({ userId: member.id, note: '  Jadwalkan riset  ' });
    const results = await Promise.all([send(), send()]);
    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    const warning = results.find((res) => res.status === 201)!.body;
    expect(warning).toMatchObject({
      userId: member.id,
      advisorId: advisor.id,
      note: 'Jadwalkan riset',
      targetMinutes: 600,
    });
    expect(warning.weekStart).toBe(getPeriod('week').days[0]);
    const own = await get(member, '/attendance/warnings');
    expect(own.status).toBe(200);
    expect(own.body.map((row: { id: string }) => row.id)).toContain(warning.id);
    expect((await get(other, '/attendance/warnings')).body).toEqual([]);
    const notification = await member.client
      .from('notifications')
      .select('*')
      .eq('id', warning.notificationId)
      .single();
    expect(notification.error).toBeNull();
    expect(notification.data).toMatchObject({ kind: 'kehadiran', message: warning.message });
  });

  it.each(['anggota', 'admin'] as const)('%s tidak dapat mengirim peringatan', async (role) => {
    expect(
      (
        await request(app)
          .post('/attendance/warnings')
          .set('Authorization', `Bearer ${(role === 'anggota' ? member : admin).token}`)
          .send({ userId: other.id })
      ).status,
    ).toBe(403);
  });

  it('target nol mencegah peringatan, penerima bukan anggota ditolak', async () => {
    await request(app)
      .put('/attendance/target')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ weeklyTargetMinutes: 0 })
      .expect(200);
    const send = (id: string) =>
      request(app)
        .post('/attendance/warnings')
        .set('Authorization', `Bearer ${advisor.token}`)
        .send({ userId: id });
    expect((await send(other.id)).body.error.code).toBe('TARGET_MET');
    expect((await send(admin.id)).status).toBe(404);
    await request(app)
      .put('/attendance/target')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ weeklyTargetMinutes: 600 })
      .expect(200);
  });

  it('admin memperbaiki sesi terbuka sekali dengan alasan dan audit', async () => {
    const checkedOutAt = new Date(Date.now() - 30 * 60_000).toISOString();
    const fix = () =>
      request(app)
        .patch(`/attendance/${openId}/correct-check-out`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ checkedOutAt, reason: 'Lupa check-out setelah riset' });
    const res = await fix();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      attendanceId: openId,
      actorId: admin.id,
      userId: other.id,
      oldCheckedOutAt: null,
    });
    expect(Date.parse(res.body.checkedOutAt)).toBe(Date.parse(checkedOutAt));
    expect((await fix()).body.error.code).toBe('SESSION_NOT_OPEN');
    expect((await get(other, '/attendance/corrections')).body).toHaveLength(1);
    expect((await get(member, '/attendance/corrections')).body).toEqual([]);
  });

  it.each(['anggota', 'advisor'] as const)('%s tidak dapat mengoreksi sesi', async (role) => {
    expect(
      (
        await request(app)
          .patch(`/attendance/${openId}/correct-check-out`)
          .set('Authorization', `Bearer ${(role === 'anggota' ? member : advisor).token}`)
          .send({ checkedOutAt: new Date().toISOString(), reason: 'Alasan valid' })
      ).status,
    ).toBe(403);
  });

  it('validasi koreksi memerlukan UUID, timestamp zona waktu, dan alasan', async () => {
    for (const [id, checkedOutAt, reason] of [
      ['bad', new Date().toISOString(), 'Alasan valid'],
      [openId, '2026-10-20', 'Alasan valid'],
      [openId, new Date().toISOString(), 'x'],
    ]) {
      expect(
        (
          await request(app)
            .patch(`/attendance/${id}/correct-check-out`)
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ checkedOutAt, reason })
        ).status,
      ).toBe(400);
    }
  });
});
