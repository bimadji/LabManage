import { Router, type Request } from 'express';
import type { Config } from '../config.js';
import { ApiError, fromDbError } from '../errors.js';
import { userClient } from '../supabase.js';

interface NotificationRow {
  id: string;
  kind: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

const COLUMNS = 'id, kind, message, read_at, created_at';

function toNotification(row: NotificationRow) {
  return {
    id: row.id,
    kind: row.kind,
    message: row.message,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** The signed-in user's notifications. Must be mounted after `requireAuth`. */
export function notificationsRouter(config: Config): Router {
  const router = Router();
  const dbFor = (req: Request) => userClient(config, req.accessToken!);

  router.get('/notifications', async (req, res) => {
    // RLS limits rows to the caller's own.
    const { data, error } = await dbFor(req)
      .from('notifications')
      .select(COLUMNS)
      .order('created_at', { ascending: false });
    if (error) throw fromDbError(error);
    res.json((data as NotificationRow[]).map(toNotification));
  });

  router.patch('/notifications/:id/read', async (req, res) => {
    const { data, error } = await dbFor(req)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select(COLUMNS)
      .maybeSingle<NotificationRow>();
    if (error) throw fromDbError(error);
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Notifikasi tidak ditemukan');
    res.json(toNotification(data));
  });

  return router;
}
