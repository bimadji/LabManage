import { useEffect, useRef, useState } from 'react';
import { elapsedMinutes, liveDurationLabel, liveMetrics } from '../monitor/liveDuration';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { apiFetch } from '../lib/api';
import { formatTime } from '../lib/datetime';
import { supabaseClient } from '../lib/supabase';
import { applyAttendanceChange, type PresentSession } from '../monitor/applyAttendanceChange';

const CHANNEL = 'attendance-monitor';

/** Live list of who is in the lab. Admin/advisor only; the API also enforces this. */
export function MonitorPage() {
  const { profile } = useProfile();
  const [sessions, setSessions] = useState<PresentSession[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const metrics = liveMetrics(sessions);
  const knownNames = useRef(new Map<string, string>());

  useEffect(() => {
    let active = true;
    const supabase = supabaseClient();

    async function load() {
      try {
        const list = await apiFetch<PresentSession[]>('/attendance/present');
        if (!active) return;
        for (const session of list) knownNames.current.set(session.userId, session.fullName);
        setSessions(list);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    }

    void load();

    const channel = supabase
      .channel(CHANNEL)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
        const change = payload as unknown as Parameters<typeof applyAttendanceChange>[1];
        setSessions((current) => {
          const next = applyAttendanceChange(current, change);
          // A new session's name is unknown to the payload; reload the list for it.
          const unknown = next.some((session) => session.fullName === '');
          if (unknown) void load();
          return next.map((session) => ({
            ...session,
            fullName: knownNames.current.get(session.userId) ?? session.fullName,
          }));
        });
      })
      .subscribe((state) => {
        setLive(state === 'SUBSCRIBED');
        setConnectionError(
          state === 'CHANNEL_ERROR' || state === 'TIMED_OUT'
            ? 'Koneksi pembaruan langsung terganggu. Coba muat ulang halaman.'
            : null,
        );
        // Realtime can miss changes while disconnected; resync when it comes back.
        if (state === 'SUBSCRIBED') void load();
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="monitor-page">
      <div className="page-head">
        <h1>Monitoring lab</h1>
        <span className={live ? 'badge badge-live' : 'badge'}>
          {live ? 'Langganan aktif' : 'Menyambung…'}
        </span>
      </div>

      <div className="monitor-actions">
        {profile?.role === 'advisor' && (
          <Link className="button" to="/monitor/rekap">
            Rekap anggota dan peringatan
          </Link>
        )}
        {profile?.role === 'admin' && (
          <Link className="button" to="/monitor/admin">
            Statistik, target, dan koreksi absensi
          </Link>
        )}
      </div>

      {connectionError && (
        <p className="card card-alert error" role="alert">
          {connectionError}
        </p>
      )}

      {status === 'loading' && (
        <div className="skeleton-stack" role="status" aria-label="Memuat kehadiran langsung">
          <span className="skeleton skeleton-heading" />
          <span className="skeleton skeleton-metric" />
          <span className="skeleton skeleton-row" />
        </div>
      )}
      {status === 'error' && (
        <p className="card card-alert error monitor-state" role="alert">
          Kehadiran gagal dimuat, atau akun Anda bukan admin/advisor.
        </p>
      )}
      {status === 'ready' && sessions.length === 0 && (
        <p className="card card-empty muted monitor-state">Tidak ada anggota di lab saat ini.</p>
      )}

      <dl className="cards live-metrics" aria-label="Kondisi laboratorium saat ini">
        <div className="card">
          <dt>Anggota di lab</dt>
          <dd>{metrics.present}</dd>
        </div>
        <div className="card">
          <dt>Lewat 21:00 WIB</dt>
          <dd>{metrics.late}</dd>
        </div>
      </dl>

      <ul className="cards monitor-members" aria-label="Anggota yang sedang di lab">
        {sessions.map((session) => (
          <li key={session.id} className="card monitor-member">
            <div className="monitor-member-heading">
              <h2>{session.fullName || 'Memuat nama…'}</h2>
              {session.overNightLimit && <span className="badge badge-warn">Lewat 21:00 WIB</span>}
            </div>
            <dl className="monitor-member-details">
              <div>
                <dt>Mulai</dt>
                <dd>{formatTime(session.checkedInAt)} WIB</dd>
              </div>
              <div>
                <dt>Durasi</dt>
                <dd className="reservation-time">
                  {liveDurationLabel(elapsedMinutes(session, now))}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
