import { useEffect, useRef, useState } from 'react';
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
        // Realtime can miss changes while disconnected; resync when it comes back.
        if (state === 'SUBSCRIBED') void load();
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section>
      <div className="page-head">
        <h1>Monitoring lab</h1>
        <span className={live ? 'badge badge-live' : 'badge'}>
          {live ? 'Langganan aktif' : 'Menyambung…'}
        </span>
      </div>

      {profile?.role === 'advisor' && (
        <p className="attendance-summary-link">
          <Link className="button" to="/monitor/rekap">
            Rekap anggota dan peringatan
          </Link>
        </p>
      )}

      {status === 'loading' && <p className="muted">Memuat kehadiran…</p>}
      {status === 'error' && (
        <p className="error" role="alert">
          Kehadiran gagal dimuat, atau akun Anda bukan admin/advisor.
        </p>
      )}
      {status === 'ready' && sessions.length === 0 && (
        <p className="muted">Tidak ada anggota di lab saat ini.</p>
      )}

      <ul className="cards">
        {sessions.map((session) => (
          <li key={session.id} className="card">
            <p className="reservation-room">{session.fullName || 'Memuat nama…'}</p>
            <p className="muted">Mulai {formatTime(session.checkedInAt)} WIB</p>
            <p className="reservation-time">{formatDuration(session.durationMinutes)}</p>
            {session.overNightLimit && <span className="badge badge-warn">Lewat 21:00 WIB</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} jam ${rest} menit` : `${rest} menit`;
}
