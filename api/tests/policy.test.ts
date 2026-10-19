import { describe, expect, it } from 'vitest';
import { isOverNightLimit, minutesOfDay, NIGHT_LIMIT_HOUR } from '../src/attendance/policy.js';

const at = (iso: string) => new Date(iso);
const open = { checkedInAt: at('2026-10-20T09:00:00+07:00'), checkedOutAt: null };

describe('minutesOfDay', () => {
  it('membaca jam WIB dari instant UTC', () => {
    expect(minutesOfDay(at('2026-10-20T14:01:00Z'))).toBe(21 * 60 + 1);
  });
});

describe('isOverNightLimit', () => {
  it('batas malam adalah 21', () => {
    expect(NIGHT_LIMIT_HOUR).toBe(21);
  });

  it('true pada 21:01 WIB', () => {
    expect(isOverNightLimit(open, at('2026-10-20T21:01:00+07:00'))).toBe(true);
  });

  it('false pada 20:59 WIB', () => {
    expect(isOverNightLimit(open, at('2026-10-20T20:59:00+07:00'))).toBe(false);
  });

  it('true tepat 21:00 WIB', () => {
    expect(isOverNightLimit(open, at('2026-10-20T21:00:00+07:00'))).toBe(true);
  });

  it('sesi tertutup memakai waktu check-out, bukan now', () => {
    const closed = {
      checkedInAt: at('2026-10-20T09:00:00+07:00'),
      checkedOutAt: at('2026-10-20T20:00:00+07:00'),
    };
    expect(isOverNightLimit(closed, at('2026-10-20T23:00:00+07:00'))).toBe(false);
  });
});
