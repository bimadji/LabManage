import { describe, expect, it } from 'vitest';
import { researchDemo } from '../src/attendance/demo.js';
import { getPeriod, summarizeAttendance } from '../src/attendance/summary.js';

describe('data demo riset', () => {
  it.each(['2026-10-18T17:00:00Z', '2026-10-25T16:59:59Z', '2025-01-01T00:00:00Z'])(
    'membuat sesi historis dan snapshot peringatan konsisten saat %s',
    (instant) => {
      const now = new Date(instant);
      const demo = researchDemo(now);
      expect(demo.sessions).toHaveLength(3);
      const warningTime = new Date(demo.warning.createdAt);
      expect(warningTime.getTime()).toBeLessThan(now.getTime());
      const summary = summarizeAttendance(
        demo.sessions.map((row, i) => ({ id: String(i), ...row })),
        getPeriod('week', demo.warning.weekStart),
        demo.warning.targetMinutes,
        warningTime,
      );
      expect(summary.totalMinutes).toBe(demo.warning.totalMinutes);
      expect(summary.status).toBe('KURANG');
      expect(summary.overNightSessionCount).toBe(1);
      expect(demo.warning.warningDate).toBe(demo.warning.createdAt.slice(0, 10));
    },
  );
});
