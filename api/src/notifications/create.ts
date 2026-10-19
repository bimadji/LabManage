import type { Config } from '../config.js';
import { serviceClient } from '../supabase.js';

export type NotificationKind = 'reservasi' | 'lembur' | 'laporan' | 'inventaris';

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

/**
 * Sends one notification to every admin. Admin decisions on inventory requests
 * need all admins to see them, and there is no broadcast channel in the schema.
 */
export async function notifyAdmins(
  config: Config,
  input: { kind: NotificationKind; message: string },
): Promise<void> {
  const { data, error } = await serviceClient(config)
    .from('profiles')
    .select('id')
    .eq('role', 'admin');
  if (error) throw error;

  await Promise.all(
    (data as { id: string }[]).map((admin) =>
      createNotification(config, {
        userId: admin.id,
        kind: input.kind,
        message: input.message,
      }),
    ),
  );
}
