import type { Config } from '../config.js';
import { serviceClient } from '../supabase.js';
import { wibParts } from '../reservations/hours.js';
import { isOverNightLimit } from '../attendance/policy.js';

export interface OvernightResult {
  /** Sessions flagged this run. */
  flagged: number;
  /** Notifications actually inserted (reruns with the same day add none). */
  created: number;
}

/**
 * Flags open sessions that have passed 21:00 WIB and notifies their owners once
 * per day. `dedupe_key` = `overnight:<userId>:<YYYY-MM-DD>` makes reruns no-ops.
 */
export async function runOvernightJob(config: Config, now: Date): Promise<OvernightResult> {
  const db = serviceClient(config);
  const { data: sessions, error } = await db
    .from('attendance')
    .select('id, user_id, checked_in_at, checked_out_at')
    .is('checked_out_at', null);
  if (error) throw error;

  const day = wibParts(now).dateKey;
  let flagged = 0;
  let created = 0;

  for (const row of sessions as { id: string; user_id: string; checked_in_at: string }[]) {
    const session = { checkedInAt: new Date(row.checked_in_at), checkedOutAt: null };
    if (!isOverNightLimit(session, now)) continue;
    flagged++;

    const { data: inserted, error: insertError } = await db
      .from('notifications')
      .upsert(
        {
          user_id: row.user_id,
          kind: 'lembur',
          message: 'Sesi kehadiran Anda masih terbuka melewati 21:00 WIB. Jangan lupa check-out.',
          dedupe_key: `overnight:${row.user_id}:${day}`,
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      )
      .select('id');
    if (insertError) throw insertError;
    created += inserted?.length ?? 0;
  }

  return { flagged, created };
}
