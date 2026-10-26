import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DailyAttendanceChart, TargetProgress, WeeklyTrendChart } from './AttendanceCharts';
import type { TrendPoint } from './chartData';

const days = [
  { date: '2026-10-19', minutes: 90, sessionCount: 2 },
  { date: '2026-10-20', minutes: 0, sessionCount: 0 },
];

const week: TrendPoint = {
  date: '2026-10-19',
  totalHours: 2.5,
  memberCount: 3,
  belowTargetCount: 1,
  attendanceRate: 0.75,
  sessionCount: 4,
  averageWeeklyHours: 2.5,
  overNightSessionCount: 1,
  overNightSessionRatio: 0.25,
  maxHours: 2.5,
};

describe('DailyAttendanceChart', () => {
  it('meringkas periode dan total pada nama aksesibel serta menyediakan tabel seri', () => {
    render(<DailyAttendanceChart days={days} periodLabel="19–20 Oktober 2026 (WIB)" />);

    const chart = screen.getByRole('img', {
      name: /Aktivitas harian 19–20 Oktober 2026 \(WIB\): total 1,5 jam dalam 2 sesi/i,
    });
    expect(within(chart).getAllByText('0 jam').length).toBeGreaterThan(0);

    const table = screen.getByRole('table', { name: 'Data aktivitas harian' });
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getByRole('cell', { name: '1,5 jam' })).toBeInTheDocument();
    expect(within(rows[2]).getByRole('cell', { name: '0 jam' })).toBeInTheDocument();
    expect(within(rows[2]).getByRole('cell', { name: '0' })).toBeInTheDocument();
  });

  it('menampilkan satu hari tanpa pembagian koordinat nol', () => {
    const { container } = render(
      <DailyAttendanceChart days={[days[0]]} periodLabel="19 Oktober 2026 (WIB)" />,
    );

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('menjelaskan data kosong tanpa merender SVG kosong', () => {
    const { container } = render(
      <DailyAttendanceChart days={[]} periodLabel="Belum ada periode" />,
    );

    expect(screen.getByText('Belum ada aktivitas harian pada periode ini.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByRole('table', { name: 'Data aktivitas harian' })).toBeInTheDocument();
  });
});

describe('WeeklyTrendChart', () => {
  it('merangkum rentang dan metrik pada nama aksesibel serta tabel lengkap', () => {
    render(<WeeklyTrendChart weeks={[week, { ...week, date: '2026-10-12', totalHours: 1 }]} />);

    expect(
      screen.getByRole('img', { name: /Tren mingguan.*12 Oktober 2026.*19 Oktober 2026/i }),
    ).toHaveAccessibleName(expect.stringContaining('2,5 jam'));

    const table = screen.getByRole('table', { name: 'Data tren mingguan' });
    expect(within(table).getByRole('columnheader', { name: 'Sesi' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Kehadiran' })).toBeInTheDocument();
    expect(
      within(table).getByRole('columnheader', { name: 'Anggota KURANG / anggota' }),
    ).toBeInTheDocument();
    expect(within(table).getAllByRole('cell', { name: '75%' })).toHaveLength(2);
    expect(within(table).getAllByRole('cell', { name: '1 / 3' })).toHaveLength(2);
  });

  it('merender satu titik sebagai dot dengan path valid dan baseline nol', () => {
    const { container } = render(
      <WeeklyTrendChart weeks={[{ ...week, totalHours: 0, maxHours: 1 }]} />,
    );

    expect(container.querySelectorAll('circle')).toHaveLength(1);
    expect(container.querySelector('path')?.getAttribute('d')).toMatch(/^M /);
    expect(container.querySelector('circle')?.getAttribute('cy')).toBe('180');
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});

describe('TargetProgress', () => {
  it('menunjukkan persen aktual di atas seratus sambil membatasi nilai progressbar', () => {
    render(<TargetProgress name="Bima" actualMinutes={900} targetMinutes={600} />);

    const progress = screen.getByRole('progressbar', { name: 'Target riset Bima' });
    expect(progress).toHaveAttribute('aria-valuenow', '100');
    expect(progress).toHaveAttribute('aria-valuetext', expect.stringContaining('150%'));
    expect(screen.getByText('150%')).toBeInTheDocument();
    expect(screen.getByText('TERCAPAI')).toBeInTheDocument();
    expect(screen.getByText(/Kekurangan 0 menit/)).toBeInTheDocument();
    expect(progress.firstElementChild).toHaveStyle({ width: '100%' });
  });

  it('menjelaskan target nol tanpa mengklaim tercapai', () => {
    render(<TargetProgress name="Bima" actualMinutes={0} targetMinutes={0} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('Target belum ditetapkan')).toBeInTheDocument();
    expect(screen.queryByText('TERCAPAI')).not.toBeInTheDocument();
  });

  it('menunjukkan kekurangan aktual saat target belum tercapai', () => {
    render(<TargetProgress name="Rani" actualMinutes={150} targetMinutes={600} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText('KURANG')).toBeInTheDocument();
    expect(screen.getByText('Kekurangan 450 menit')).toBeInTheDocument();
  });
});
