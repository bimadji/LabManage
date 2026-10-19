import { describe, expect, it } from 'vitest';
import { applyAttendanceChange, type PresentSession } from './applyAttendanceChange';

const existing: PresentSession = {
  id: 'att-1',
  userId: 'user-1',
  checkedInAt: '2026-10-20T02:00:00+00:00',
  checkedOutAt: null,
  fullName: 'Anggota Demo',
  durationMinutes: 30,
  overNightLimit: false,
};

describe('applyAttendanceChange', () => {
  it('INSERT menambah sesi', () => {
    const next = applyAttendanceChange([], {
      eventType: 'INSERT',
      new: {
        id: 'att-2',
        user_id: 'user-2',
        checked_in_at: '2026-10-20T03:00:00+00:00',
        checked_out_at: null,
      },
      old: {},
    });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'att-2', userId: 'user-2', checkedOutAt: null });
  });

  it('UPDATE dengan checked_out_at menghapus sesi', () => {
    const next = applyAttendanceChange([existing], {
      eventType: 'UPDATE',
      new: {
        id: 'att-1',
        user_id: 'user-1',
        checked_in_at: existing.checkedInAt,
        checked_out_at: '2026-10-20T04:00:00+00:00',
      },
      old: { id: 'att-1' },
    });
    expect(next).toEqual([]);
  });

  it('UPDATE lain tidak mengubah daftar', () => {
    const next = applyAttendanceChange([existing], {
      eventType: 'UPDATE',
      new: {
        id: 'att-1',
        user_id: 'user-1',
        checked_in_at: existing.checkedInAt,
        checked_out_at: null,
      },
      old: { id: 'att-1' },
    });
    expect(next).toEqual([existing]);
  });

  it('INSERT untuk sesi yang sudah ada tidak menduplikasi', () => {
    const next = applyAttendanceChange([existing], {
      eventType: 'INSERT',
      new: {
        id: 'att-1',
        user_id: 'user-1',
        checked_in_at: existing.checkedInAt,
        checked_out_at: null,
      },
      old: {},
    });
    expect(next).toHaveLength(1);
  });

  it('DELETE menghapus sesi', () => {
    const next = applyAttendanceChange([existing], {
      eventType: 'DELETE',
      new: {
        id: 'att-1',
        user_id: 'user-1',
        checked_in_at: existing.checkedInAt,
        checked_out_at: null,
      },
      old: { id: 'att-1' },
    });
    expect(next).toEqual([]);
  });
});
