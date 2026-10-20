import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Config } from '../src/config.js';
import { getPeriod, summarizeAttendance } from '../src/attendance/summary.js';
import { anonClient, serviceClient } from '../src/supabase.js';
import { createTestUser, deleteTestUsers, testConfig, type TestUser } from './helpers/db.js';

let config: Config;
let member: TestUser;
let otherMember: TestUser;
let admin: TestUser;
let advisor: TestUser;
let otherAdvisor: TestUser;
const users: TestUser[] = [];
let originalSettings: Record<string, unknown> | undefined;

const db = () => serviceClient(config);
const warning = (user: TestUser, userId = member.id, note = '') =>
  user.client.rpc('send_attendance_warning', { p_user_id: userId, p_note: note });
const correction = (
  user: TestUser,
  attendanceId: string,
  checkedOutAt: string | null,
  reason: string | null = 'Lupa melakukan check-out',
) =>
  user.client.rpc('correct_attendance_session', {
    p_attendance_id: attendanceId,
    p_checked_out_at: checkedOutAt,
    p_reason: reason,
  });

async function clearFixtures() {
  const ids = users.map((user) => user.id);
  if (ids.length === 0) return;
  // Hanya baris pengguna yang dibuat file ini; urutan mengikuti foreign key.
  for (const table of [
    'attendance_corrections',
    'attendance_warnings',
    'notifications',
    'attendance',
  ]) {
    const { error } = await db().from(table).delete().in('user_id', ids);
    // Tabel belum tersedia pada tahap RED sebelum migrasi.
    if (error && !['PGRST205', '42P01'].includes(error.code)) throw error;
  }
}

async function session(user = member, start = Date.now() - 3_600_000, end: number | null = null) {
  const { data, error } = await db()
    .from('attendance')
    .insert({
      user_id: user.id,
      checked_in_at: new Date(start).toISOString(),
      checked_out_at: end === null ? null : new Date(end).toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as {
    id: string;
    user_id: string;
    checked_in_at: string;
    checked_out_at: string | null;
  };
}

function expectRpcError(result: { error: { code: string; message: string } | null }, code: string) {
  expect(result.error).toMatchObject({ code: 'P0001', message: code });
}

beforeAll(async () => {
  config = testConfig();
  // Catat setiap pengguna segera agar cleanup tetap lengkap bila setup berikutnya gagal.
  for (const role of ['anggota', 'anggota', 'admin', 'advisor', 'advisor'] as const) {
    users.push(await createTestUser(config, role));
  }
  [member, otherMember, admin, advisor, otherAdvisor] = users;
  const { data } = await db().from('attendance_settings').select().eq('id', true).maybeSingle();
  originalSettings = data ?? undefined;
}, 30_000);

beforeEach(async () => {
  await clearFixtures();
  // Semua file test database dijalankan berurutan. Pulihkan nilai asli di afterAll.
  const { error } = await db()
    .from('attendance_settings')
    .update({ weekly_target_minutes: 600 })
    .eq('id', true);
  if (error && !['PGRST205', '42P01'].includes(error.code)) throw error;
});

afterAll(async () => {
  if (!config) return;
  await clearFixtures();
  if (originalSettings) {
    const { error } = await db()
      .from('attendance_settings')
      .update(originalSettings)
      .eq('id', true);
    if (error) throw error;
  }
  await deleteTestUsers(config, users);
});

describe('RLS target kehadiran', () => {
  it('semua peran membaca singleton, tetapi anon tidak dapat membaca', async () => {
    for (const user of [member, admin, advisor]) {
      const { data, error } = await user.client.from('attendance_settings').select();
      expect(error).toBeNull();
      expect(data).toEqual([expect.objectContaining({ id: true, weekly_target_minutes: 600 })]);
    }
    const { error } = await anonClient(config).from('attendance_settings').select();
    expect(error?.code).toBe('42501');
  });

  it('hanya admin mengubah target, dengan aktor dan waktu dari database', async () => {
    for (const user of [member, advisor]) {
      const { data, error } = await user.client
        .from('attendance_settings')
        .update({ weekly_target_minutes: 17 })
        .eq('id', true)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
    const before = Date.now();
    const { data, error } = await admin.client
      .from('attendance_settings')
      .update({ weekly_target_minutes: 123 })
      .eq('id', true)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ weekly_target_minutes: 123, updated_by: admin.id });
    expect(Date.parse(data.updated_at)).toBeGreaterThanOrEqual(before - 1_000);
    const spoof = await admin.client
      .from('attendance_settings')
      .update({ updated_by: member.id })
      .eq('id', true);
    expect(spoof.error?.code).toBe('42501');
  });

  it('menolak target negatif, terlalu besar, pecahan, insert dan delete klien', async () => {
    for (const value of [-1, 10081, 1.5]) {
      const { error } = await admin.client
        .from('attendance_settings')
        .update({ weekly_target_minutes: value })
        .eq('id', true);
      expect(error).not.toBeNull();
    }
    const insert = await admin.client
      .from('attendance_settings')
      .insert({ id: false, weekly_target_minutes: 5 });
    expect(insert.error?.code).toBe('42501');
    const deletion = await admin.client.from('attendance_settings').delete().eq('id', true);
    expect(deletion.error?.code).toBe('42501');
    const { data } = await db()
      .from('attendance_settings')
      .select('weekly_target_minutes')
      .single();
    expect(data?.weekly_target_minutes).toBe(600);
  });
});

describe('RPC peringatan dan audit', () => {
  it.each(['pecahan', 'mikrodetik'])(
    'batas target konsisten dengan rekap untuk %s',
    async (kind) => {
      const target = await admin.client
        .from('attendance_settings')
        .update({ weekly_target_minutes: 1 })
        .eq('id', true);
      expect(target.error).toBeNull();
      const start = Date.now() - 120_000;
      const rows =
        kind === 'pecahan'
          ? Array.from({ length: 3 }, (_, index) => ({
              user_id: member.id,
              checked_in_at: new Date(start + index * 20_000).toISOString(),
              checked_out_at: new Date(start + (index + 1) * 20_000).toISOString(),
            }))
          : [
              {
                user_id: member.id,
                checked_in_at: new Date(start).toISOString().replace('Z', '500Z'),
                checked_out_at: new Date(start + 60_000).toISOString(),
              },
            ];
      const saved = await db().from('attendance').insert(rows).select();
      expect(saved.error).toBeNull();
      const result = await warning(advisor);
      const now = new Date(result.data?.created_at ?? Date.now());
      const summary = summarizeAttendance(
        saved.data!.map((row) => ({
          id: row.id,
          checkedInAt: row.checked_in_at,
          checkedOutAt: row.checked_out_at,
        })),
        getPeriod('week', undefined, now),
        1,
        now,
      );
      if (summary.status === 'TERCAPAI') expectRpcError(result, 'TARGET_MET');
      else {
        expect(result.error).toBeNull();
        expect(result.data.total_minutes).toBeCloseTo(summary.totalMinutes, 10);
      }
    },
  );

  it('menolak anggota/admin, RPC anonim, serta anggota tujuan yang tidak tersedia', async () => {
    for (const user of [member, admin]) expectRpcError(await warning(user), 'FORBIDDEN');
    const anonymous = await anonClient(config).rpc('send_attendance_warning', {
      p_user_id: member.id,
    });
    expect(anonymous.error?.code).toBe('42501');
    for (const userId of [admin.id, advisor.id, randomUUID()]) {
      expectRpcError(await warning(advisor, userId), 'MEMBER_NOT_FOUND');
    }
  });

  it('menulis notifikasi kehadiran dan log snake_case dengan tanggal WIB dalam satu RPC', async () => {
    const { data, error } = await warning(advisor, member.id, '  Tingkatkan kehadiran  ');
    expect(error).toBeNull();
    const todayWib = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    expect(data).toMatchObject({
      user_id: member.id,
      advisor_id: advisor.id,
      warning_date: todayWib,
      note: 'Tingkatkan kehadiran',
      total_minutes: 0,
      target_minutes: 600,
    });
    expect(new Date(`${data.week_start}T00:00:00Z`).getUTCDay()).toBe(1);
    const { data: notification } = await member.client
      .from('notifications')
      .select()
      .eq('id', data.notification_id)
      .single();
    expect(notification).toMatchObject({
      user_id: member.id,
      kind: 'kehadiran',
      message: data.message,
      dedupe_key: `attendance-warning:${member.id}:${todayWib}`,
    });
    expect(notification.message).toContain('Tingkatkan kehadiran');
  });

  it('dua advisor bersamaan menghasilkan tepat satu log dan satu notifikasi', async () => {
    const results = await Promise.all([warning(advisor), warning(otherAdvisor)]);
    expect(results.filter((result) => result.error === null)).toHaveLength(1);
    expectRpcError(
      results.find((result) => result.error !== null)!,
      'WARNING_ALREADY_SENT',
    );
    for (const table of ['attendance_warnings', 'notifications']) {
      const { count, error } = await db()
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', member.id);
      expect(error).toBeNull();
      expect(count).toBe(1);
    }
  });

  it('menolak target tepat tercapai dan tidak membulatkan menit pecahan ke target', async () => {
    await admin.client
      .from('attendance_settings')
      .update({ weekly_target_minutes: 1 })
      .eq('id', true);
    const end = Date.now() - 1_000;
    const row = await session(member, end - 59_999, end);
    const result = await warning(advisor);
    expect(result.error).toBeNull();
    const weekStart = Date.parse(
      getPeriod('week', undefined, new Date(result.data.created_at)).start,
    );
    expect(result.data.total_minutes).toBeCloseTo(
      Math.max(0, end - Math.max(end - 59_999, weekStart)) / 60_000,
      10,
    );
    await clearFixtures();
    await session(member, Date.parse(row.checked_in_at), end + 1);
    const exact = await warning(advisor);
    if (end - 59_999 >= weekStart) expectRpcError(exact, 'TARGET_MET');
    else expect(exact.error).toBeNull();
    const { count } = await db()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', member.id);
    expect(count).toBe(end - 59_999 >= weekStart ? 0 : 1);
  });

  it('memotong sesi pada Senin WIB dan sekarang serta mengabaikan sesi masa depan', async () => {
    const now = Date.now();
    const wib = new Date(now + 7 * 3_600_000);
    const monday =
      Date.UTC(
        wib.getUTCFullYear(),
        wib.getUTCMonth(),
        wib.getUTCDate() - ((wib.getUTCDay() + 6) % 7),
      ) -
      7 * 3_600_000;
    await session(member, monday - 60_000, monday + 60_000);
    await session(member, now + 3_600_000, now + 7_200_000);
    await session(member, now - 120_000, now + 3_600_000);
    const { data, error } = await warning(advisor);
    expect(error).toBeNull();
    const sentAt = Date.parse(data.created_at);
    const expected =
      Math.max(0, Math.min(monday + 60_000, sentAt) - monday) +
      Math.max(0, Math.min(now + 3_600_000, sentAt) - Math.max(now - 120_000, monday));
    expect(data.total_minutes).toBeCloseTo(expected / 60_000, 10);
  });

  it('sesi terbuka dihitung sampai sekarang dan target nol langsung tercapai', async () => {
    const row = await session(member, Date.now() - 120_000);
    const { data, error } = await warning(advisor);
    expect(error).toBeNull();
    const sentAt = new Date(data.created_at);
    const weekStart = Date.parse(getPeriod('week', undefined, sentAt).start);
    expect(data.total_minutes).toBeCloseTo(
      (sentAt.getTime() - Math.max(Date.parse(row.checked_in_at), weekStart)) / 60_000,
      10,
    );
    await admin.client
      .from('attendance_settings')
      .update({ weekly_target_minutes: 0 })
      .eq('id', true);
    expectRpcError(await warning(advisor, otherMember.id), 'TARGET_MET');
  });

  it('kegagalan notifikasi tidak meninggalkan log atau menghabiskan kuota harian', async () => {
    const todayWib = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    const { data: blocker, error } = await db()
      .from('notifications')
      .insert({
        user_id: member.id,
        kind: 'reservasi',
        message: 'Fixture konflik deduplikasi',
        dedupe_key: `attendance-warning:${member.id}:${todayWib}`,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    const failed = await warning(advisor);
    expect(failed.error).not.toBeNull();
    const { count } = await db()
      .from('attendance_warnings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', member.id);
    expect(count).toBe(0);
    await db().from('notifications').delete().eq('id', blocker!.id);
    expect((await warning(advisor)).error).toBeNull();
  });

  it('validasi catatan terlalu panjang terjadi tanpa menulis notifikasi', async () => {
    expectRpcError(await warning(advisor, member.id, 'a'.repeat(1001)), 'VALIDATION_ERROR');
    const { count } = await db()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', member.id);
    expect(count).toBe(0);
  });
});

describe('RPC koreksi sesi dan pembatasan update langsung', () => {
  it('menolak RPC anggota/advisor dan tidak memberi execute ke anon', async () => {
    const row = await session();
    const end = new Date(Date.now() - 1_000).toISOString();
    for (const user of [member, advisor]) {
      expectRpcError(await correction(user, row.id, end), 'FORBIDDEN');
    }
    const anonymous = await anonClient(config).rpc('correct_attendance_session', {
      p_attendance_id: row.id,
      p_checked_out_at: end,
      p_reason: 'Lupa check-out',
    });
    expect(anonymous.error?.code).toBe('42501');
  });

  it('koreksi admin menyimpan sebelum/sesudah dan menutup sesi dalam transaksi yang sama', async () => {
    const row = await session();
    const end = new Date(Date.now() - 1_000).toISOString();
    const { data, error } = await correction(admin, row.id, end, '  Lupa check-out  ');
    expect(error).toBeNull();
    expect(data).toMatchObject({
      attendance_id: row.id,
      user_id: member.id,
      actor_id: admin.id,
      old_checked_out_at: null,
      reason: 'Lupa check-out',
    });
    expect(Date.parse(data.checked_out_at)).toBe(Date.parse(end));
    const { data: updated } = await db()
      .from('attendance')
      .select('checked_out_at')
      .eq('id', row.id)
      .single();
    expect(Date.parse(updated!.checked_out_at)).toBe(Date.parse(end));
    expectRpcError(await correction(admin, row.id, end), 'SESSION_NOT_OPEN');
  });

  it('koreksi bersamaan hanya mencatat satu audit dan tidak mengubah sesi tertutup', async () => {
    const row = await session();
    const ends = [
      new Date(Date.now() - 2_000).toISOString(),
      new Date(Date.now() - 1_000).toISOString(),
    ];
    const results = await Promise.all(ends.map((end) => correction(admin, row.id, end)));
    const winner = results.find((result) => !result.error)!;
    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expectRpcError(
      results.find((result) => result.error)!,
      'SESSION_NOT_OPEN',
    );
    const { data: audits } = await db()
      .from('attendance_corrections')
      .select()
      .eq('attendance_id', row.id);
    expect(audits).toHaveLength(1);
    const { data: saved } = await db().from('attendance').select().eq('id', row.id).single();
    expect(saved.checked_out_at).toBe(winner.data.checked_out_at);
  });

  it('validasi waktu/alasan dan sesi hilang tidak mengubah sesi atau membuat audit', async () => {
    const row = await session();
    const end = new Date(Date.now() - 1_000).toISOString();
    for (const invalidEnd of [
      null,
      row.checked_in_at,
      new Date(Date.now() + 60_000).toISOString(),
    ]) {
      expectRpcError(await correction(admin, row.id, invalidEnd), 'INVALID_CHECKOUT');
    }
    for (const reason of [null, '    ', '\n\t \r\n', 'abcd', '  abcd\t ', 'a'.repeat(1001)]) {
      expectRpcError(await correction(admin, row.id, end, reason), 'VALIDATION_ERROR');
    }
    expectRpcError(await correction(admin, randomUUID(), end), 'SESSION_NOT_FOUND');
    const { data } = await db()
      .from('attendance')
      .select('checked_out_at')
      .eq('id', row.id)
      .single();
    expect(data?.checked_out_at).toBeNull();
    const { count } = await db()
      .from('attendance_corrections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', member.id);
    expect(count).toBe(0);
  });

  it('advisor tidak dapat update sesi sendiri, admin tidak dapat melewati audit milik anggota', async () => {
    const memberSession = await session();
    const advisorSession = await session(advisor);
    for (const [actor, row] of [
      [advisor, advisorSession],
      [admin, memberSession],
      [otherMember, memberSession],
    ] as const) {
      const { data, error } = await actor.client
        .from('attendance')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('id', row.id)
        .select();
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
    const { data } = await db()
      .from('attendance')
      .select('checked_out_at')
      .in('id', [memberSession.id, advisorSession.id]);
    expect(data).toEqual([{ checked_out_at: null }, { checked_out_at: null }]);
  });

  it('anggota/admin tetap dapat checkout sendiri tetapi tidak membuka atau mengedit ulang sesi', async () => {
    for (const user of [member, admin]) {
      const row = await session(user);
      const end = new Date(Date.now() - 1_000).toISOString();
      const closed = await user.client
        .from('attendance')
        .update({ checked_out_at: end })
        .eq('id', row.id)
        .select();
      expect(closed.error).toBeNull();
      expect(closed.data).toHaveLength(1);
      for (const value of [null, new Date().toISOString()]) {
        const retry = await user.client
          .from('attendance')
          .update({ checked_out_at: value })
          .eq('id', row.id)
          .select();
        expect(retry.error).toBeNull();
        expect(retry.data).toEqual([]);
      }
    }
  });
});

describe('RLS log peringatan dan koreksi', () => {
  it('pemilik membaca log sendiri, anggota lain tidak, admin/advisor dapat membaca keduanya', async () => {
    const row = await session();
    const warningResult = await warning(advisor);
    expect(warningResult.error).toBeNull();
    const correctionResult = await correction(
      admin,
      row.id,
      new Date(Date.now() - 1_000).toISOString(),
    );
    expect(correctionResult.error).toBeNull();
    for (const table of ['attendance_warnings', 'attendance_corrections']) {
      for (const user of [member, admin, advisor, otherAdvisor]) {
        const { data, error } = await user.client.from(table).select().eq('user_id', member.id);
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
      }
      const other = await otherMember.client.from(table).select().eq('user_id', member.id);
      expect(other.error).toBeNull();
      expect(other.data).toEqual([]);
      const anonymous = await anonClient(config).from(table).select();
      expect(anonymous.error?.code).toBe('42501');
    }
  });

  it('seluruh peran tidak dapat insert, update, atau delete log langsung', async () => {
    const row = await session();
    const warningResult = await warning(advisor);
    expect(warningResult.error).toBeNull();
    const correctionResult = await correction(
      admin,
      row.id,
      new Date(Date.now() - 1_000).toISOString(),
    );
    expect(correctionResult.error).toBeNull();
    for (const [table, record] of [
      ['attendance_warnings', warningResult.data],
      ['attendance_corrections', correctionResult.data],
    ] as const) {
      for (const user of [member, admin, advisor]) {
        const inserted = await user.client.from(table).insert({ ...record, id: randomUUID() });
        expect(inserted.error?.code).toBe('42501');
        const updated = await user.client
          .from(table)
          .update({ user_id: otherMember.id })
          .eq('id', record.id);
        expect(updated.error?.code).toBe('42501');
        const deleted = await user.client.from(table).delete().eq('id', record.id);
        expect(deleted.error?.code).toBe('42501');
      }
      const { data } = await db().from(table).select('user_id').eq('id', record.id).single();
      expect(data?.user_id).toBe(member.id);
    }
  });
});
