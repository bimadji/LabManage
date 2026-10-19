export interface PresentSession {
  id: string;
  userId: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  fullName: string;
  durationMinutes: number;
  overNightLimit: boolean;
}

/** A `postgres_changes` payload from the `attendance` table. */
export interface AttendanceChange {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: { id: string; user_id: string; checked_in_at: string; checked_out_at: string | null };
  old: { id?: string };
}

/**
 * Applies one Realtime change to the open-session list.
 * INSERT adds a session (name filled in later by the caller), UPDATE with
 * `checked_out_at` removes it, any other UPDATE is ignored, DELETE removes it.
 */
export function applyAttendanceChange(
  list: PresentSession[],
  change: AttendanceChange,
): PresentSession[] {
  const id = change.new?.id ?? change.old?.id;
  if (!id) return list;

  if (change.eventType === 'DELETE' || change.new?.checked_out_at) {
    return list.filter((session) => session.id !== id);
  }

  if (change.eventType === 'INSERT') {
    if (list.some((session) => session.id === id)) return list;
    return [
      ...list,
      {
        id,
        userId: change.new.user_id,
        checkedInAt: change.new.checked_in_at,
        checkedOutAt: null,
        fullName: '',
        durationMinutes: 0,
        overNightLimit: false,
      },
    ];
  }

  return list;
}
