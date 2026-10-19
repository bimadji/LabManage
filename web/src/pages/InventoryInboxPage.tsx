import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { apiFetch, ApiRequestError } from '../lib/api';
import { REQUEST_STATUS_LABEL, type BadgeTone } from '../lib/inventory';
import type { ComponentRequest, LoanRequest, RequestStatus } from '../types';

type Tab = 'komponen' | 'pinjam';
type StatusFilter = 'semua' | RequestStatus;

const STATUS_TONE: Record<RequestStatus, BadgeTone> = {
  menunggu: 'warn',
  dikonfirmasi: 'ok',
  disetujui: 'ok',
  ditolak: 'bad',
  dibatalkan: 'muted',
};

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: 'badge badge-ok',
  warn: 'badge badge-warn',
  bad: 'badge badge-bad',
  muted: 'badge',
};

/** Admin/advisor inbox for component take-requests and loan-requests. */
export function InventoryInboxPage() {
  const { profile, loading } = useProfile();
  const isAdmin = profile?.role === 'admin';

  const [tab, setTab] = useState<Tab>('komponen');
  const [status, setStatus] = useState<StatusFilter>('semua');
  const [components, setComponents] = useState<ComponentRequest[]>([]);
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<ComponentRequest[]>('/component-requests'),
      apiFetch<LoanRequest[]>('/loan-requests'),
    ])
      .then(([componentList, loanList]) => {
        if (!active) return;
        setComponents(componentList);
        setLoans(loanList);
        setLoadState('ready');
      })
      .catch(() => {
        if (active) setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Mark unread pending rows as read once, then reload so the badge is accurate.
  useEffect(() => {
    if (!isAdmin || loadState !== 'ready') return;

    const unread = [
      ...components
        .filter((row) => row.status === 'menunggu' && row.adminReadAt === null)
        .map((row) => `/component-requests/${row.id}/read`),
      ...loans
        .filter((row) => row.status === 'menunggu' && row.adminReadAt === null)
        .map((row) => `/loan-requests/${row.id}/read`),
    ];
    if (unread.length === 0) return;

    void Promise.all(unread.map((path) => apiFetch(path, { method: 'PATCH' })))
      .then(() => setReloadKey((key) => key + 1))
      .catch(() => undefined);
  }, [isAdmin, loadState, components, loans]);

  async function decide(path: string, body?: object) {
    setError(null);
    try {
      await apiFetch(path, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Aksi gagal. Coba lagi.');
    }
  }

  if (loading) return <p className="muted">Memuat…</p>;
  if (profile === null) return <p className="muted">Halaman ini hanya untuk admin dan advisor.</p>;

  const matches = (rowStatus: RequestStatus) => status === 'semua' || rowStatus === status;
  const visibleComponents = components.filter((row) => matches(row.status));
  const visibleLoans = loans.filter((row) => matches(row.status));

  return (
    <section>
      <div className="page-head">
        <h1>Kotak masuk inventaris</h1>
        <Link className="link-back" to="/inventaris">
          Kembali ke inventaris
        </Link>
      </div>

      <div className="inventory-filters">
        <label className="filter" htmlFor="inbox-tab">
          <span>Jenis permintaan</span>
          <select id="inbox-tab" value={tab} onChange={(e) => setTab(e.target.value as Tab)}>
            <option value="komponen">Laporan ambil</option>
            <option value="pinjam">Permintaan pinjam</option>
          </select>
        </label>

        <label className="filter" htmlFor="inbox-status">
          <span>Status</span>
          <select
            id="inbox-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="semua">Semua</option>
            <option value="menunggu">MENUNGGU</option>
            <option value="dikonfirmasi">DIKONFIRMASI</option>
            <option value="disetujui">DISETUJUI</option>
            <option value="ditolak">DITOLAK</option>
            <option value="dibatalkan">DIBATALKAN</option>
          </select>
        </label>
      </div>

      {loadState === 'loading' && <p className="muted">Memuat permintaan…</p>}
      {loadState === 'error' && (
        <p className="error" role="alert">
          Permintaan gagal dimuat. Muat ulang halaman.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {tab === 'komponen' && (
        <>
          <h2>Laporan ambil</h2>
          {loadState === 'ready' && visibleComponents.length === 0 && (
            <p className="muted">Tidak ada laporan.</p>
          )}
          <ul className="cards">
            {visibleComponents.map((row) => (
              <li key={row.id} className="card">
                <p className="reservation-room">{row.itemName ?? 'Item terhapus'}</p>
                <p className="muted">
                  {row.requesterName ?? 'Tanpa nama'} · jumlah {row.qty}
                </p>
                {row.note && <p className="muted">{row.note}</p>}
                <span className={TONE_CLASS[STATUS_TONE[row.status]]}>
                  {REQUEST_STATUS_LABEL[row.status]}
                </span>
                {row.adminReadAt === null && <p className="muted">Belum dibaca</p>}
                {row.adminNote && <p className="muted">Catatan admin: {row.adminNote}</p>}
                {isAdmin && row.status === 'menunggu' && (
                  <div className="page-head">
                    <button
                      type="button"
                      onClick={() => void decide(`/component-requests/${row.id}/confirm`)}
                    >
                      Konfirmasi
                    </button>
                    <RejectForm
                      onSubmit={(note) =>
                        decide(`/component-requests/${row.id}/reject`, { note: note || undefined })
                      }
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'pinjam' && (
        <>
          <h2>Permintaan pinjam</h2>
          {loadState === 'ready' && visibleLoans.length === 0 && (
            <p className="muted">Tidak ada permintaan.</p>
          )}
          <ul className="cards">
            {visibleLoans.map((row) => (
              <li key={row.id} className="card">
                <p className="reservation-room">{row.itemName ?? 'Item terhapus'}</p>
                <p className="muted">{row.requesterName ?? 'Tanpa nama'}</p>
                <p className="muted">{row.purpose}</p>
                {row.expectedReturnAt && (
                  <p className="muted">Perkiraan kembali {row.expectedReturnAt}</p>
                )}
                <span className={TONE_CLASS[STATUS_TONE[row.status]]}>
                  {REQUEST_STATUS_LABEL[row.status]}
                </span>
                {row.adminReadAt === null && <p className="muted">Belum dibaca</p>}
                {row.adminNote && <p className="muted">Catatan admin: {row.adminNote}</p>}
                {isAdmin && row.status === 'menunggu' && (
                  <div className="page-head">
                    <button
                      type="button"
                      onClick={() => void decide(`/loan-requests/${row.id}/approve`)}
                    >
                      Setujui
                    </button>
                    <RejectForm
                      onSubmit={(note) =>
                        decide(`/loan-requests/${row.id}/reject`, { note: note || undefined })
                      }
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

interface RejectFormProps {
  onSubmit: (note: string) => Promise<void>;
}

function RejectForm({ onSubmit }: RejectFormProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSubmit(note.trim());
    setOpen(false);
    setNote('');
  }

  if (!open) {
    return (
      <button type="button" className="link-back" onClick={() => setOpen(true)}>
        Tolak
      </button>
    );
  }

  return (
    <form className="inline-form" onSubmit={submit} noValidate>
      <label htmlFor="alasan-tolak">Alasan (opsional)</label>
      <input
        id="alasan-tolak"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
      />
      <button type="submit">Kirim penolakan</button>
    </form>
  );
}
