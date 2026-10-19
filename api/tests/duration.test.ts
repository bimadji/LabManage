import { describe, expect, it } from 'vitest';
import { durationMinutes } from '../src/attendance/duration.js';

const at = (iso: string) => new Date(iso);

describe('durationMinutes', () => {
  it('sesi tertutup 90 menit', () => {
    const session = {
      checkedInAt: at('2026-10-20T09:00:00+07:00'),
      checkedOutAt: at('2026-10-20T10:30:00+07:00'),
    };
    expect(durationMinutes(session, at('2026-10-20T12:00:00+07:00'))).toBe(90);
  });

  it('sesi 0 menit', () => {
    const session = {
      checkedInAt: at('2026-10-20T09:00:00+07:00'),
      checkedOutAt: at('2026-10-20T09:00:00+07:00'),
    };
    expect(durationMinutes(session, at('2026-10-20T12:00:00+07:00'))).toBe(0);
  });

  it('sesi terbuka memakai now, bukan checkedOutAt', () => {
    const session = { checkedInAt: at('2026-10-20T09:00:00+07:00'), checkedOutAt: null };
    expect(durationMinutes(session, at('2026-10-20T10:30:00+07:00'))).toBe(90);
    expect(durationMinutes(session, at('2026-10-20T11:00:00+07:00'))).toBe(120);
  });

  it('tidak pernah negatif', () => {
    const session = { checkedInAt: at('2026-10-20T09:00:00+07:00'), checkedOutAt: null };
    expect(durationMinutes(session, at('2026-10-20T08:00:00+07:00'))).toBe(0);
  });
});
