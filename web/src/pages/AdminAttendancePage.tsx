import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { AdminCorrectionHistory, AdminOpenSessions } from '../attendance/AdminCorrections';
import { AdminStatistics } from '../attendance/AdminStatistics';
import { AdminTarget } from '../attendance/AdminTarget';
import type { AdminActions, MemberStatistics } from '../attendance/admin';

function AdminContent({ actor }: { actor: { id: string; fullName: string } }) {
  const [revisions, setRevisions] = useState({ statistics: 0, target: 0, sessions: 0, history: 0 });
  const [members, setMembers] = useState<MemberStatistics[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const reload = (panel: keyof typeof revisions) =>
    setRevisions((value) => ({ ...value, [panel]: value[panel] + 1 }));
  const actions: AdminActions = {
    busy,
    begin: () => {
      if (locked.current) return false;
      locked.current = true;
      setBusy(true);
      setMessage(null);
      return true;
    },
    end: () => {
      locked.current = false;
      setBusy(false);
    },
    saved: (kind, text) => {
      setMessage(text);
      setRevisions((value) => ({
        ...value,
        statistics: value.statistics + 1,
        sessions: value.sessions + (kind === 'correction' ? 1 : 0),
        history: value.history + (kind === 'correction' ? 1 : 0),
      }));
    },
  };
  return (
    <>
      <div className="summary-actions">
        <Link className="button" to="/monitor">
          Monitoring langsung
        </Link>
        <button
          disabled={busy}
          onClick={() => {
            setMessage(null);
            setRevisions((value) => ({
              statistics: value.statistics + 1,
              target: value.target + 1,
              sessions: value.sessions + 1,
              history: value.history + 1,
            }));
          }}
        >
          Muat ulang semua
        </button>
      </div>
      <p className="muted">
        Kelola target dan koreksi kehadiran. Statistik diperbarui setelah penyimpanan; gunakan Muat
        ulang semua untuk mengambil perubahan terbaru dari pengguna lain.
      </p>
      {busy && <p role="status">Menyimpan perubahan…</p>}
      {message && <p role="status">{message}</p>}
      <section className="card" aria-label="Target mingguan">
        <h2>Target mingguan</h2>
        <AdminTarget key={revisions.target} actions={actions} retry={() => reload('target')} />
      </section>
      <AdminStatistics revision={revisions.statistics} onMembers={setMembers} />
      <section aria-label="Koreksi sesi terbuka">
        <h2>Koreksi sesi terbuka</h2>
        <AdminOpenSessions
          key={revisions.sessions}
          actions={actions}
          retry={() => reload('sessions')}
        />
      </section>
      <section aria-label="Riwayat koreksi">
        <h2>Riwayat koreksi</h2>
        <AdminCorrectionHistory
          key={revisions.history}
          members={members}
          actor={actor}
          busy={busy}
          retry={() => reload('history')}
        />
      </section>
    </>
  );
}

export function AdminAttendancePage() {
  const { profile, loading } = useProfile();
  return (
    <section className="admin-attendance-page">
      <h1>Statistik dan pengelolaan absensi</h1>
      {loading ? (
        <p role="status">Memuat profil…</p>
      ) : !profile ? (
        <p role="alert" className="error">
          Profil gagal dimuat. Muat ulang halaman.
        </p>
      ) : profile.role !== 'admin' ? (
        <p>Halaman ini khusus admin. Gunakan halaman yang sesuai dengan peran Anda.</p>
      ) : (
        <AdminContent key={profile.id} actor={profile} />
      )}
    </section>
  );
}
