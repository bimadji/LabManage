import type { Config } from '../config.js';
import { serviceClient } from '../supabase.js';

export type NotificationKind = 'reservasi' | 'lembur' | 'laporan';

export interface NewNotification {
  userId: string;
  kind: NotificationKind;
  message: string;
  /** Repeating notifications share a key so a rerun cannot duplicate them. */
  dedupeKey?: string;
}

/**
 * Writes a notification with the service role (clients have no insert policy).
 * When `dedupeKey` is given, an existing row with the same key is left untouched.
 */
export async function createNotification(config: Config, input: NewNotification): Promise<void> {
  const { error } = await serviceClient(config)
    .from('notifications')
    .upsert(
      {
        user_id: input.userId,
        kind: input.kind,
        message: input.message,
        dedupe_key: input.dedupeKey ?? null,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    );
  if (error) throw error;
}
