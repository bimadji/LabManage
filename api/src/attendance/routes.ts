import { Router, type Request } from 'express';
import { requireRole } from '../auth/requireAuth.js';
import type { Config } from '../config.js';
import { ApiError, fromDbError } from '../errors.js';
import { userClient } from '../supabase.js';

interface AttendanceRow {
  id: string;
  user_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
}

const COLUMNS = 'id, user_id, checked_in_at, checked_out_at';

function toSession(row: AttendanceRow) {
  return {
    id: row.id,
    userId: row.user_id,
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at,
  };
}

/** Check-in, check-out, and the list of open sessions. Must be mounted after `requireAuth`. */
export function attendanceRouter(config: Config): Router {
  const router = Router();
  const dbFor = (req: Request) => userClient(config, req.accessToken!);

  router.post('/attendance/check-in', requireRole('anggota', 'admin'), async (req, res) => {
    const { data, error } = await dbFor(req)
      .from('attendance')
      .insert({ user_id: req.user!.id })
      .select(COLUMNS)
      .single<AttendanceRow>();

    if (error) {
      // Unique partial index: one open session per user.
      if (error.code === '23505') {
        throw new ApiError(409, 'ALREADY_IN', 'Anda masih memiliki sesi kehadiran yang terbuka');
      }
      throw fromDbError(error);
    }
    res.status(201).json(toSession(data));
  });

  router.post('/attendance/check-out', requireRole('anggota', 'admin'), async (req, res) => {
    const db = dbFor(req);
    const { data: open, error: findError } = await db
      .from('attendance')
      .select(COLUMNS)
      .eq('user_id', req.user!.id)
      .is('checked_out_at', null)
      .maybeSingle<AttendanceRow>();
    if (findError) throw fromDbError(findError);
    if (!open) throw new ApiError(404, 'NOT_IN', 'Tidak ada sesi kehadiran yang terbuka');

    const { data, error } = await db
      .from('attendance')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('id', open.id)
      .select(COLUMNS)
      .single<AttendanceRow>();
    if (error) throw fromDbError(error);
    res.json(toSession(data));
  });

  router.get('/attendance/present', requireRole('admin', 'advisor'), async (req, res) => {
    const db = dbFor(req);
    const { data: sessions, error } = await db
      .from('attendance')
      .select(COLUMNS)
      .is('checked_out_at', null)
      .order('checked_in_at');
    if (error) throw fromDbError(error);

    const userIds = [...new Set((sessions as AttendanceRow[]).map((row) => row.user_id))];
    const names = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await db
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      if (profileError) throw fromDbError(profileError);
      for (const profile of profiles as { id: string; full_name: string }[]) {
        names.set(profile.id, profile.full_name);
      }
    }

    res.json(
      (sessions as AttendanceRow[]).map((row) => ({
        ...toSession(row),
        fullName: names.get(row.user_id) ?? 'Tanpa nama',
      })),
    );
  });

  return router;
}
