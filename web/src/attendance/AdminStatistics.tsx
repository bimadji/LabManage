import { useEffect, useState } from 'react';
import {
  hours,
  percent,
  periodLabel,
  todayWib,
  useAdminResource,
  type AggregateStatistics,
  type MemberStatistics,
  type ResearchMetrics,
  type StatisticsResponse,
} from './admin';

function Metrics({ data }: { data: ResearchMetrics }) {
  return (
    <>
      <div>
        <dt>Total riset</dt>
        <dd>{hours(data.totalHours)}</dd>
      </div>
      <div>
        <dt>Jumlah sesi</dt>
        <dd>{data.sessionCount}</dd>
      </div>
      <div>
        <dt>Rata-rata mingguan</dt>
        <dd>{hours(data.averageWeeklyHours)}</dd>
      </div>
      <div>
        <dt>Tingkat kehadiran</dt>
        <dd>{percent(data.attendanceRate)}</dd>
      </div>
      <div>
        <dt>Sesi lewat 21:00 WIB</dt>
        <dd>
          {percent(data.overNightSessionRatio)} ({data.overNightSessionCount} dari{' '}
          {data.sessionCount} sesi)
        </dd>
      </div>
    </>
  );
}
function Aggregate({ data }: { data: AggregateStatistics }) {
  return (
    <dl className="summary-metrics">
      <div>
        <dt>Jumlah anggota</dt>
        <dd>{data.memberCount}</dd>
      </div>
      <div>
        <dt>Anggota KURANG</dt>
        <dd>{data.belowTargetCount}</dd>
      </div>
      <Metrics data={data} />
    </dl>
  );
}

function StatisticsData({
  query,
  retry,
  onMembers,
}: {
  query: string;
  retry: () => void;
  onMembers: (members: MemberStatistics[]) => void;
}) {
  const { data, error } = useAdminResource<StatisticsResponse>(`/attendance/statistics?${query}`);
  useEffect(() => {
    if (data) onMembers(data.members);
  }, [data, onMembers]);
  if (error)
    return (
      <>
        <p role="alert" className="error">
          {error}
        </p>
        <button onClick={retry}>Coba lagi statistik</button>
      </>
    );
  if (!data) return <p role="status">Memuat statistik…</p>;
  return (
    <>
      <p className="summary-period">{periodLabel(data.period)}</p>
      <p>
        Target periode per anggota: {hours(data.targetMinutes / 60)}. Target mingguan:{' '}
        {hours(data.weeklyTargetMinutes / 60)}.
      </p>
      <p className="muted">
        Rata-rata mingguan memakai panjang periode penuh; ringkasan menampilkan rata-rata per
        anggota. Tingkat kehadiran memakai hari kalender berlalu, termasuk hari ini. Rasio malam
        menghitung sesi yang melewati 21:00 WIB.
      </p>
      <section className="card" aria-label="Ringkasan statistik">
        <h3>Ringkasan statistik</h3>
        <Aggregate data={data.aggregate} />
      </section>
      <section aria-label="Statistik per anggota">
        <h3>Statistik per anggota</h3>
        {data.members.length === 0 ? (
          <p>Belum ada anggota untuk ditampilkan.</p>
        ) : (
          <div className="admin-attendance-list">
            {data.members.map((member) => (
              <article
                className="card"
                key={member.userId}
                aria-label={`Statistik ${member.fullName}`}
              >
                <h4>{member.fullName}</h4>
                <span
                  className={member.status === 'KURANG' ? 'badge badge-warn' : 'badge badge-ok'}
                >
                  {member.status}
                </span>
                <dl className="summary-metrics">
                  <Metrics data={member} />
                  <div>
                    <dt>Hari hadir</dt>
                    <dd>
                      {member.daysPresent} dari {member.elapsedDays} hari berlalu
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
      <section aria-label="Tren mingguan">
        <h3>Tren mingguan</h3>
        <p className="muted">
          Tren berakhir pada minggu yang memuat tanggal pilihan. Data mengikuti anggota dan target
          yang berlaku saat rekap dimuat.
        </p>
        <ol className="admin-attendance-list">
          {data.trend.map((week) => (
            <li className="card" key={week.period.start}>
              <h4>{periodLabel(week.period)}</h4>
              <Aggregate data={week} />
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export function AdminStatistics({
  revision,
  onMembers,
}: {
  revision: number;
  onMembers: (members: MemberStatistics[]) => void;
}) {
  const [period, setPeriod] = useState('week');
  const [date, setDate] = useState(todayWib);
  const [weeks, setWeeks] = useState('8');
  const [query, setQuery] = useState(() =>
    new URLSearchParams({ period: 'week', date: todayWib(), weeks: '8' }).toString(),
  );
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  return (
    <section aria-label="Statistik riset">
      <h2>Statistik riset</h2>
      <form
        className="summary-filters admin-statistics-filters"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !date ||
            !Number.isInteger(Number(weeks)) ||
            Number(weeks) < 1 ||
            Number(weeks) > 52
          ) {
            setError('Pilih tanggal dan jumlah minggu tren 1–52.');
            return;
          }
          setError(null);
          setQuery(new URLSearchParams({ period, date, weeks: String(Number(weeks)) }).toString());
          setAttempt((value) => value + 1);
        }}
      >
        <label>
          Periode
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="week">Mingguan</option>
            <option value="month">Bulanan</option>
          </select>
        </label>
        <label>
          Tanggal dalam periode (WIB)
          <input
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Jumlah minggu tren
          <input
            type="number"
            required
            min={1}
            max={52}
            step={1}
            value={weeks}
            onChange={(event) => setWeeks(event.target.value)}
          />
        </label>
        <button type="submit">Tampilkan statistik</button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <StatisticsData
        key={`${query}:${revision}:${attempt}`}
        query={query}
        retry={() => setAttempt((value) => value + 1)}
        onMembers={onMembers}
      />
    </section>
  );
}
