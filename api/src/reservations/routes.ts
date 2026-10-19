import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/requireAuth.js';
import type { Config } from '../config.js';
import { ApiError, fromDbError } from '../errors.js';
import { createNotification } from '../notifications/create.js';
import { userClient } from '../supabase.js';
import { isoInstant, uuid, validate } from '../validation.js';
import { isWithinLabHours } from './hours.js';

interface ReservationRow {
  id: string;
  room_id: string;
  team: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  status: 'aktif' | 'dibatalkan';
  created_at: string;
}

const RESERVATION_COLUMNS = 'id, room_id, team, user_id, starts_at, ends_at, status, created_at';
const MAX_TEAM_LENGTH = 100;

const createReservationSchema = z.object({
  roomId: uuid,
  team: z.string().trim().min(1, 'team wajib diisi').max(MAX_TEAM_LENGTH),
  startsAt: isoInstant,
  endsAt: isoInstant,
});

const listReservationsSchema = z.object({
  from: isoInstant.optional(),
  to: isoInstant.optional(),
});

function toReservation(row: ReservationRow) {
  return {
    id: row.id,
    roomId: row.room_id,
    team: row.team,
    userId: row.user_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Rooms and reservations. Must be mounted after `requireAuth`. */
export function reservationsRouter(config: Config): Router {
  const router = Router();
  // Every query runs as the caller, so RLS is enforced by the database.
  const dbFor = (req: Request) => userClient(config, req.accessToken!);

  router.get('/rooms', async (req, res) => {
    const { data, error } = await dbFor(req).from('rooms').select('id, name, kind').order('name');
    if (error) throw fromDbError(error);
    res.json(data);
  });

  router.get('/reservations', validate(listReservationsSchema, 'query'), async (req, res) => {
    const { from, to } = req.query as { from?: string; to?: string };
    let query = dbFor(req).from('reservations').select(RESERVATION_COLUMNS).order('starts_at');
    // Overlap filter: a reservation is in [from, to) when it ends after `from` and starts before `to`.
    if (from) query = query.gt('ends_at', new Date(from).toISOString());
    if (to) query = query.lt('starts_at', new Date(to).toISOString());

    const { data, error } = await query;
    if (error) throw fromDbError(error);
    res.json((data as ReservationRow[]).map(toReservation));
  });

  router.post(
    '/reservations',
    requireRole('anggota', 'admin'),
    validate(createReservationSchema),
    async (req, res) => {
      const { roomId, team, startsAt, endsAt } = req.body as z.infer<
        typeof createReservationSchema
      >;
      const starts = new Date(startsAt);
      const ends = new Date(endsAt);
      if (ends <= starts) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Waktu selesai harus setelah waktu mulai');
      }

      const db = dbFor(req);

      const { data: hours, error: hoursError } = await db
        .from('lab_hours')
        .select('weekday, opens_at, closes_at');
      if (hoursError) throw fromDbError(hoursError);
      const labHours = (hours as { weekday: number; opens_at: string; closes_at: string }[]).map(
        (row) => ({ weekday: row.weekday, opensAt: row.opens_at, closesAt: row.closes_at }),
      );
      if (!isWithinLabHours(starts, ends, labHours)) {
        throw new ApiError(
          422,
          'OUTSIDE_HOURS',
          'Reservasi harus berada di dalam jam operasional lab (07:00-21:00 WIB)',
        );
      }

      // Friendly pre-check; the exclusion constraint on reservations is the real guard.
      const { data: conflicting, error: conflictError } = await db
        .from('reservations')
        .select('id')
        .eq('room_id', roomId)
        .eq('status', 'aktif')
        .lt('starts_at', ends.toISOString())
        .gt('ends_at', starts.toISOString())
        .limit(1);
      if (conflictError) throw fromDbError(conflictError);
      if (conflicting.length > 0) {
        throw new ApiError(409, 'CONFLICT', 'Ruang sudah dipesan pada rentang waktu tersebut');
      }

      const { data, error } = await db
        .from('reservations')
        .insert({
          room_id: roomId,
          team,
          // Owner always comes from the verified token, never from the request body.
          user_id: req.user!.id,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
        })
        .select(RESERVATION_COLUMNS)
        .single<ReservationRow>();
      if (error) throw fromDbError(error);

      await createNotification(config, {
        userId: data.user_id,
        kind: 'reservasi',
        message: `Reservasi ${data.team} pada ${data.starts_at} tercatat.`,
      });

      res.status(201).json(toReservation(data));
    },
  );

  router.patch('/reservations/:id/cancel', async (req, res) => {
    const user = req.user!;
    const db = dbFor(req);

    const { data: existing, error } = await db
      .from('reservations')
      .select(RESERVATION_COLUMNS)
      .eq('id', req.params.id)
      .maybeSingle<ReservationRow>();
    if (error) throw fromDbError(error);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Reservasi tidak ditemukan');
    if (existing.user_id !== user.id && user.role !== 'admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Hanya pemilik atau admin yang dapat membatalkan');
    }

    const { data: updated, error: updateError } = await db
      .from('reservations')
      .update({ status: 'dibatalkan' })
      .eq('id', req.params.id)
      .select(RESERVATION_COLUMNS)
      .maybeSingle<ReservationRow>();
    if (updateError) throw fromDbError(updateError);
    // RLS filtered the row out of the update: the caller is not allowed to change it.
    if (!updated) {
      throw new ApiError(403, 'FORBIDDEN', 'Anda tidak berhak membatalkan reservasi ini');
    }

    await createNotification(config, {
      userId: updated.user_id,
      kind: 'reservasi',
      message: `Reservasi ${updated.team} pada ${updated.starts_at} dibatalkan.`,
    });

    res.json(toReservation(updated));
  });

  return router;
}
