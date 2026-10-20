import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/requireAuth.js';
import type { Config } from '../config.js';
import { ApiError, fromDbError } from '../errors.js';
import { userClient } from '../supabase.js';
import { uuid, validate } from '../validation.js';
import {
  getPeriod,
  summarizeAttendance,
  type AttendancePeriod,
  type AttendanceSummary,
} from './summary.js';

const periodQuery = z.object({
  period: z.enum(['week', 'month']).default('week'),
  date: z.string().optional(),
  userId: uuid.optional(),
});
const statisticsQuery = periodQuery.omit({ userId: true }).extend({
  weeks: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(52))
    .default(8),
});
const ownerQuery = z.object({ userId: uuid.optional() });
const targetBody = z.object({ weeklyTargetMinutes: z.number().int().min(0).max(10080) }).strict();
const warningBody = z
  .object({ userId: uuid, note: z.string().trim().max(1000).default('') })
  .strict();
const correctionBody = z
  .object({
    checkedOutAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(5).max(1000),
  })
  .strict();

interface SettingsRow {
  weekly_target_minutes: number;
  updated_at: string;
  updated_by: string | null;
}
interface SessionRow {
  id: string;
  user_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
}
interface ProfileRow {
  id: string;
  full_name: string;
}
interface WarningRow {
  id: string;
  user_id: string;
  advisor_id: string;
  week_start: string;
  warning_date: string;
  note: string;
  message: string;
  total_minutes: number;
  target_minutes: number;
  notification_id: string;
  created_at: string;
}
interface CorrectionRow {
  id: string;
  attendance_id: string;
  user_id: string;
  actor_id: string;
  old_checked_out_at: string | null;
  checked_out_at: string;
  reason: string;
  created_at: string;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Data tidak valid');
    error.issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw error;
  }
  return result.data;
}

function periodFor(kind: 'week' | 'month', date: string | undefined, now: Date) {
  try {
    return getPeriod(kind, date, now);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    throw new ApiError(400, 'VALIDATION_ERROR', 'Tanggal atau periode tidak valid');
  }
}

// Supabase membatasi hasil tiap permintaan; setiap halaman harus berurutan stabil.
async function readAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await page(from, from + 499);
    if (error) throw fromDbError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

function ownerFor(req: Request, selected?: string): string | undefined {
  if (req.user!.role !== 'anggota') return selected;
  if (selected && selected !== req.user!.id) {
    throw new ApiError(403, 'FORBIDDEN', 'Anda hanya dapat membaca absensi sendiri');
  }
  return req.user!.id;
}

async function settingsFor(db: SupabaseClient): Promise<SettingsRow> {
  const { data, error } = await db
    .from('attendance_settings')
    .select('weekly_target_minutes,updated_at,updated_by')
    .eq('id', true)
    .single<SettingsRow>();
  if (error) throw fromDbError(error);
  return data;
}
const toTarget = (row: SettingsRow) => ({
  weeklyTargetMinutes: row.weekly_target_minutes,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});
const toWarning = (row: WarningRow) => ({
  id: row.id,
  userId: row.user_id,
  advisorId: row.advisor_id,
  weekStart: row.week_start,
  warningDate: row.warning_date,
  note: row.note,
  message: row.message,
  totalMinutes: row.total_minutes,
  targetMinutes: row.target_minutes,
  notificationId: row.notification_id,
  createdAt: row.created_at,
});
const toCorrection = (row: CorrectionRow) => ({
  id: row.id,
  attendanceId: row.attendance_id,
  userId: row.user_id,
  actorId: row.actor_id,
  oldCheckedOutAt: row.old_checked_out_at,
  checkedOutAt: row.checked_out_at,
  reason: row.reason,
  createdAt: row.created_at,
});

function rpcError(error: PostgrestError): ApiError {
  const messages: Record<string, [number, string]> = {
    FORBIDDEN: [403, 'Anda tidak berhak melakukan aksi ini'],
    MEMBER_NOT_FOUND: [404, 'Anggota tidak ditemukan'],
    TARGET_MET: [409, 'Anggota sudah memenuhi target minggu berjalan'],
    WARNING_ALREADY_SENT: [409, 'Peringatan untuk anggota ini sudah dikirim hari ini'],
    SESSION_NOT_FOUND: [404, 'Sesi kehadiran tidak ditemukan'],
    SESSION_NOT_OPEN: [409, 'Sesi kehadiran sudah ditutup'],
    INVALID_CHECKOUT: [400, 'Waktu selesai harus setelah mulai dan tidak melebihi waktu sekarang'],
    VALIDATION_ERROR: [400, 'Data tidak valid'],
  };
  const mapped = error.code === 'P0001' ? messages[error.message] : undefined;
  return mapped ? new ApiError(mapped[0], error.message, mapped[1]) : fromDbError(error);
}

async function dataset(db: SupabaseClient, start: string, end: string, userId?: string) {
  const [profiles, sessions] = await Promise.all([
    readAll<ProfileRow>((from, to) => {
      let query = db.from('profiles').select('id,full_name').eq('role', 'anggota').order('id');
      if (userId) query = query.eq('id', userId);
      return query.range(from, to);
    }),
    readAll<SessionRow>((from, to) => {
      let query = db
        .from('attendance')
        .select('id,user_id,checked_in_at,checked_out_at')
        .lt('checked_in_at', end)
        .or(`checked_out_at.is.null,checked_out_at.gt.${start}`)
        .order('id');
      if (userId) query = query.eq('user_id', userId);
      return query.range(from, to);
    }),
  ]);
  if (userId && profiles.length === 0)
    throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Anggota tidak ditemukan');
  const byUser = new Map<string, SessionRow[]>();
  for (const row of sessions) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }
  return { profiles, byUser };
}

function membersFor(
  data: Awaited<ReturnType<typeof dataset>>,
  period: AttendancePeriod,
  target: number,
  now: Date,
) {
  return data.profiles.map((profile) => ({
    userId: profile.id,
    fullName: profile.full_name,
    ...summarizeAttendance(
      (data.byUser.get(profile.id) ?? []).map((row) => ({
        id: row.id,
        checkedInAt: row.checked_in_at,
        checkedOutAt: row.checked_out_at,
      })),
      period,
      target,
      now,
    ),
  }));
}

function aggregate(members: AttendanceSummary[]) {
  const sum = (
    key:
      | 'totalMinutes'
      | 'sessionCount'
      | 'daysPresent'
      | 'elapsedDays'
      | 'overNightSessionCount'
      | 'averageWeeklyHours',
  ) => members.reduce((total, member) => total + member[key], 0);
  const totalMinutes = sum('totalMinutes');
  const sessionCount = sum('sessionCount');
  const elapsedDays = sum('elapsedDays');
  const overNightSessionCount = sum('overNightSessionCount');
  return {
    memberCount: members.length,
    totalMinutes,
    totalHours: totalMinutes / 60,
    sessionCount,
    belowTargetCount: members.filter((member) => member.status === 'KURANG').length,
    averageWeeklyHours: members.length ? sum('averageWeeklyHours') / members.length : 0,
    attendanceRate: elapsedDays ? sum('daysPresent') / elapsedDays : 0,
    overNightSessionCount,
    overNightSessionRatio: sessionCount ? overNightSessionCount / sessionCount : 0,
  };
}

/** Rekap dan mutasi riset memakai JWT pengguna, sehingga RLS tetap ditegakkan. */
export function researchAttendanceRouter(config: Config): Router {
  const router = Router();
  const dbFor = (req: Request) => userClient(config, req.accessToken!);

  router.get('/attendance/target', async (req, res) => {
    res.json(toTarget(await settingsFor(dbFor(req))));
  });
  router.put('/attendance/target', requireRole('admin'), validate(targetBody), async (req, res) => {
    const { data, error } = await dbFor(req)
      .from('attendance_settings')
      .update({ weekly_target_minutes: req.body.weeklyTargetMinutes })
      .eq('id', true)
      .select('weekly_target_minutes,updated_at,updated_by')
      .single<SettingsRow>();
    if (error) throw fromDbError(error);
    res.json(toTarget(data));
  });

  router.get('/attendance/summary', async (req, res) => {
    const query = parse(periodQuery, req.query);
    const owner = ownerFor(req, query.userId);
    const now = new Date();
    const period = periodFor(query.period, query.date, now);
    const db = dbFor(req);
    const settings = await settingsFor(db);
    const data = await dataset(db, period.start, period.end, owner);
    const target = settings.weekly_target_minutes;
    res.json({
      period,
      weeklyTargetMinutes: target,
      targetMinutes: summarizeAttendance([], period, target, now).targetMinutes,
      members: membersFor(data, period, target, now),
    });
  });

  router.get('/attendance/statistics', requireRole('admin'), async (req, res) => {
    const query = parse(statisticsQuery, req.query);
    const now = new Date();
    const period = periodFor(query.period, query.date, now);
    const lastWeek = periodFor('week', query.date, now);
    const weeks = Array.from({ length: query.weeks }, (_, index) => {
      const instant = new Date(
        Date.parse(lastWeek.start) - (query.weeks - index - 1) * 7 * 86400_000,
      );
      const date = new Date(instant.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
      return periodFor('week', date, now);
    });
    const db = dbFor(req);
    const settings = await settingsFor(db);
    const start = new Date(
      Math.min(Date.parse(period.start), Date.parse(weeks[0].start)),
    ).toISOString();
    const end = new Date(Math.max(Date.parse(period.end), Date.parse(lastWeek.end))).toISOString();
    const data = await dataset(db, start, end);
    const target = settings.weekly_target_minutes;
    const members = membersFor(data, period, target, now);
    res.json({
      period,
      weeklyTargetMinutes: target,
      targetMinutes: summarizeAttendance([], period, target, now).targetMinutes,
      members,
      aggregate: aggregate(members),
      trend: weeks.map((week) => ({
        period: week,
        ...aggregate(membersFor(data, week, target, now)),
      })),
    });
  });

  router.post(
    '/attendance/warnings',
    requireRole('advisor'),
    validate(warningBody),
    async (req, res) => {
      const { data, error } = await dbFor(req).rpc('send_attendance_warning', {
        p_user_id: req.body.userId,
        p_note: req.body.note,
      });
      if (error) throw rpcError(error);
      res.status(201).json(toWarning(data as WarningRow));
    },
  );
  router.get('/attendance/warnings', async (req, res) => {
    const owner = ownerFor(req, parse(ownerQuery, req.query).userId);
    const db = dbFor(req);
    const rows = await readAll<WarningRow>((from, to) => {
      let query = db
        .from('attendance_warnings')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id');
      if (owner) query = query.eq('user_id', owner);
      return query.range(from, to);
    });
    res.json(rows.map(toWarning));
  });
  router.patch(
    '/attendance/:id/correct-check-out',
    requireRole('admin'),
    validate(correctionBody),
    async (req, res) => {
      const id = parse(uuid, req.params.id);
      const { data, error } = await dbFor(req).rpc('correct_attendance_session', {
        p_attendance_id: id,
        p_checked_out_at: req.body.checkedOutAt,
        p_reason: req.body.reason,
      });
      if (error) throw rpcError(error);
      res.json(toCorrection(data as CorrectionRow));
    },
  );
  router.get('/attendance/corrections', async (req, res) => {
    const owner = ownerFor(req, parse(ownerQuery, req.query).userId);
    const db = dbFor(req);
    const rows = await readAll<CorrectionRow>((from, to) => {
      let query = db
        .from('attendance_corrections')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id');
      if (owner) query = query.eq('user_id', owner);
      return query.range(from, to);
    });
    res.json(rows.map(toCorrection));
  });
  return router;
}
