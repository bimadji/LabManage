import { useId } from 'react';
import { targetProgress, type AttendanceDay, type TrendPoint } from './chartData';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const fullDate = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const shortDate = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
});

const WIDTH = 720;
const LEFT = 64;
const RIGHT = 680;
const TOP = 38;
const BASELINE = 180;
const HEIGHT = 230;
const PLOT_HEIGHT = BASELINE - TOP;

/** Tanggal YYYY-MM-DD selalu dibaca sebagai waktu WIB, bukan zona waktu perangkat. */
function wibDate(date: string): Date {
  return new Date(`${date}T00:00:00+07:00`);
}

function formatDate(date: string): string {
  return fullDate.format(wibDate(date));
}

function formatNumber(value: number): string {
  return number.format(value);
}

function formatHours(hours: number): string {
  return `${formatNumber(hours)} jam`;
}

function formatMinutes(minutes: number): string {
  return formatHours(minutes / 60);
}

function formatPercent(rate: number): string {
  return `${formatNumber(rate * 100)}%`;
}

function ChartAxes({ maximum }: { maximum: number }) {
  return (
    <>
      {[maximum, maximum / 2, 0].map((value) => {
        const y = BASELINE - (value / maximum) * PLOT_HEIGHT;
        return (
          <g key={value}>
            <line
              className="attendance-chart__grid"
              x1={LEFT}
              x2={RIGHT}
              y1={y}
              y2={y}
              stroke="currentColor"
              opacity={0.16}
            />
            <text className="attendance-chart__tick" x={LEFT - 10} y={y + 4} textAnchor="end">
              {formatNumber(value)}
            </text>
          </g>
        );
      })}
      <line
        className="attendance-chart__baseline"
        x1={LEFT}
        x2={RIGHT}
        y1={BASELINE}
        y2={BASELINE}
        stroke="currentColor"
        opacity={0.4}
      />
    </>
  );
}

export function DailyAttendanceChart({
  days,
  periodLabel,
}: {
  days: AttendanceDay[];
  periodLabel: string;
}) {
  const headingId = useId();
  const totalMinutes = days.reduce((total, day) => total + day.minutes, 0);
  const totalSessions = days.reduce((total, day) => total + day.sessionCount, 0);
  const maximum = Math.max(
    1,
    ...days.map((day) => (Number.isFinite(day.minutes) ? day.minutes / 60 : 0)),
  );
  const slotWidth = days.length > 0 ? (RIGHT - LEFT) / days.length : 0;
  const barWidth = Math.min(48, slotWidth * 0.56);
  const dense = days.length > 14;
  const dateStep = Math.max(1, Math.ceil(days.length / 8));
  const summary = `Aktivitas harian ${periodLabel}: total ${formatMinutes(totalMinutes)} dalam ${formatNumber(totalSessions)} sesi.`;

  return (
    <section className="card attendance-chart attendance-daily-chart" aria-labelledby={headingId}>
      <h3 id={headingId}>Aktivitas harian</h3>
      {days.length === 0 && (
        <p className="attendance-chart__empty">Belum ada aktivitas harian pada periode ini.</p>
      )}
      {days.length > 0 && (
        <p className="attendance-chart__summary">
          Total {formatMinutes(totalMinutes)} · {formatNumber(totalSessions)} sesi
        </p>
      )}
      {days.length > 0 && (
        <svg
          className="attendance-chart__svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={summary}
        >
          <text className="attendance-chart__axis-title" x={LEFT} y={18}>
            Durasi (jam)
          </text>
          <ChartAxes maximum={maximum} />
          {days.map((day, index) => {
            const hours = day.minutes / 60;
            const height = (hours / maximum) * PLOT_HEIGHT;
            const center = LEFT + slotWidth * (index + 0.5);
            const y = BASELINE - height;
            const showDate = !dense || index % dateStep === 0 || index === days.length - 1;
            return (
              <g className="attendance-chart__day" key={day.date}>
                <rect
                  className="attendance-chart__bar"
                  x={center - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={height}
                  fill="currentColor"
                />
                <text
                  className="attendance-chart__value"
                  x={center}
                  y={Math.max(TOP - 8, y - 8)}
                  textAnchor="middle"
                >
                  {dense ? formatNumber(hours) : formatHours(hours)}
                </text>
                {showDate && (
                  <text className="attendance-chart__tick" x={center} y={202} textAnchor="middle">
                    {shortDate.format(wibDate(day.date))}
                  </text>
                )}
              </g>
            );
          })}
          <text className="attendance-chart__axis-title" x={RIGHT} y={224} textAnchor="end">
            Tanggal (WIB)
          </text>
        </svg>
      )}
      <details className="attendance-chart__data">
        <summary>Lihat data aktivitas harian</summary>
        <div className="attendance-chart__table-wrap">
          <table>
            <caption>Data aktivitas harian</caption>
            <thead>
              <tr>
                <th scope="col">Tanggal</th>
                <th scope="col">Durasi</th>
                <th scope="col">Sesi</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date}>
                  <th scope="row">
                    <time dateTime={day.date}>{formatDate(day.date)}</time>
                  </th>
                  <td>{formatMinutes(day.minutes)}</td>
                  <td>{formatNumber(day.sessionCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function WeeklyTrendChart({ weeks }: { weeks: TrendPoint[] }) {
  const headingId = useId();
  const maximum = Math.max(
    1,
    ...weeks.map((week) =>
      Math.max(
        Number.isFinite(week.maxHours) ? week.maxHours : 0,
        Number.isFinite(week.totalHours) ? week.totalHours : 0,
      ),
    ),
  );
  const dates = weeks.map((week) => week.date).sort();
  const firstDate = dates[0];
  const lastDate = dates.at(-1);
  const range =
    firstDate === undefined
      ? ''
      : firstDate === lastDate
        ? formatDate(firstDate)
        : `${formatDate(firstDate)} hingga ${formatDate(lastDate ?? firstDate)}`;
  const summary = `Tren mingguan ${range}: ${weeks
    .map((week) => `${formatDate(week.date)} ${formatHours(week.totalHours)}`)
    .join('; ')}.`;
  const step = weeks.length > 1 ? (RIGHT - LEFT) / (weeks.length - 1) : 0;
  const points = weeks.map((week, index) => ({
    week,
    x: weeks.length === 1 ? (LEFT + RIGHT) / 2 : LEFT + step * index,
    y: Math.max(
      TOP,
      BASELINE - ((Number.isFinite(week.totalHours) ? week.totalHours : 0) / maximum) * PLOT_HEIGHT,
    ),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const dense = weeks.length > 12;
  const labelStep = Math.max(1, Math.ceil(weeks.length / 6));

  return (
    <section className="card attendance-chart attendance-weekly-chart" aria-labelledby={headingId}>
      <h3 id={headingId}>Tren mingguan</h3>
      {weeks.length === 0 ? (
        <p className="attendance-chart__empty">Belum ada data tren mingguan.</p>
      ) : (
        <svg
          className="attendance-chart__svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={summary}
        >
          <text className="attendance-chart__axis-title" x={LEFT} y={18}>
            Total riset (jam)
          </text>
          <ChartAxes maximum={maximum} />
          <path
            className="attendance-chart__line"
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          />
          {points.map(({ week, x, y }, index) => {
            const edge = index === 0 || index === weeks.length - 1;
            const showLabel = !dense || edge || index % labelStep === 0;
            const anchor =
              weeks.length === 1 ? 'middle' : index === 0 ? 'start' : edge ? 'end' : 'middle';
            return (
              <g className="attendance-chart__point" key={week.date}>
                <circle cx={x} cy={y} r={4} fill="currentColor" />
                {showLabel && (
                  <text
                    className="attendance-chart__value"
                    x={x}
                    y={Math.max(TOP - 8, y - 12)}
                    textAnchor={anchor}
                  >
                    {dense ? formatNumber(week.totalHours) : formatHours(week.totalHours)}
                  </text>
                )}
                {(!dense || edge || index % labelStep === 0) && (
                  <text className="attendance-chart__tick" x={x} y={202} textAnchor={anchor}>
                    {shortDate.format(wibDate(week.date))}
                  </text>
                )}
              </g>
            );
          })}
          <text className="attendance-chart__axis-title" x={RIGHT} y={224} textAnchor="end">
            Minggu mulai (WIB)
          </text>
        </svg>
      )}
      {weeks.length > 0 && (
        <details className="attendance-chart__data">
          <summary>Lihat data tren mingguan</summary>
          <div className="attendance-chart__table-wrap">
            <table>
              <caption>Data tren mingguan</caption>
              <thead>
                <tr>
                  <th scope="col">Minggu mulai (WIB)</th>
                  <th scope="col">Total riset</th>
                  <th scope="col">Rata-rata mingguan</th>
                  <th scope="col">Sesi</th>
                  <th scope="col">Kehadiran</th>
                  <th scope="col">Sesi lewat 21:00 WIB</th>
                  <th scope="col">Anggota KURANG / anggota</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week.date}>
                    <th scope="row">
                      <time dateTime={week.date}>{formatDate(week.date)}</time>
                    </th>
                    <td>{formatHours(week.totalHours)}</td>
                    <td>{formatHours(week.averageWeeklyHours ?? 0)}</td>
                    <td>{formatNumber(week.sessionCount)}</td>
                    <td>{formatPercent(week.attendanceRate)}</td>
                    <td>
                      {formatPercent(week.overNightSessionRatio ?? 0)} (
                      {formatNumber(week.overNightSessionCount ?? 0)} dari{' '}
                      {formatNumber(week.sessionCount)} sesi)
                    </td>
                    <td>
                      {formatNumber(week.belowTargetCount)} / {formatNumber(week.memberCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

export function TargetProgress({
  name,
  actualMinutes,
  targetMinutes,
  status,
}: {
  name: string;
  actualMinutes: number;
  targetMinutes: number;
  status?: 'KURANG' | 'TERCAPAI';
}) {
  const progress = targetProgress(actualMinutes, targetMinutes);
  const hasTarget = targetMinutes > 0 && Number.isFinite(targetMinutes);
  const badge = status ?? (progress.percent >= 100 ? 'TERCAPAI' : 'KURANG');
  const remaining = `Kekurangan ${formatNumber(progress.remainingMinutes)} menit`;

  return (
    <div className="attendance-target">
      {hasTarget ? (
        <>
          <p className="attendance-target__heading">
            <span className={badge === 'TERCAPAI' ? 'badge badge-ok' : 'badge badge-warn'}>
              {badge}
            </span>
            <span className="attendance-target__percent">{formatNumber(progress.percent)}%</span>
          </p>
          <p>{remaining}</p>
        </>
      ) : (
        <p>Target belum ditetapkan</p>
      )}
      <div
        className="attendance-target__bar"
        role="progressbar"
        aria-label={`Target riset ${name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.ratio * 100)}
        aria-valuetext={
          hasTarget
            ? `${formatNumber(progress.percent)}%; ${badge}; ${remaining}`
            : 'Target belum ditetapkan'
        }
      >
        <div className="attendance-target__fill" style={{ width: `${progress.ratio * 100}%` }} />
      </div>
    </div>
  );
}

/** Placeholder selama rekap/statistik benar-benar dimuat; teks status tetap terbaca pembaca layar. */
export function ChartSkeleton({ label }: { label: string }) {
  return (
    <div className="skeleton-stack" role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      <span className="skeleton skeleton-heading" aria-hidden="true" />
      <span className="skeleton skeleton-chart" aria-hidden="true" />
      <span className="skeleton skeleton-row" aria-hidden="true" />
    </div>
  );
}
