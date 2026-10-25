import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { apiFetch, ApiRequestError } from '../lib/api';
import { REQUEST_STATUS_LABEL, type BadgeTone } from '../lib/inventory';
import type { ComponentRequest, LoanRequest, RequestStatus } from '../types';

type Tab = 'komponen' | 'pinjam';

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
  const [components, setComponents] = useState<ComponentRequest[]>([]);
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);

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
    if (pending.current) return false;
    pending.current = true;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await apiFetch(path, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      });
      setLoadState('loading');
      setReloadKey((key) => key + 1);
      setNotice('Keputusan berhasil disimpan.');
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Aksi gagal. Coba lagi.');
      return false;
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  if (loading)
    return (
      <p className="muted" role="status">
        Memuat…
      </p>
    );
  if (profile === null)
    return (
      <section className="inventory-requests-page">
        <div className="page-head">
          <div>
            <h1>Kotak masuk inventaris</h1>
            <p className="muted">Halaman ini hanya untuk admin dan advisor.</p>
          </div>
          <Link className="link-back" to="/inventaris">
            Kembali ke inventaris
          </Link>
        </div>
      </section>
    );

  const visibleComponents = components.filter((row) => row.status === 'menunggu');
  const visibleLoans = loans.filter((row) => row.status === 'menunggu');

  return (
    <section className="inventory-requests-page">
      <div className="page-head">
        <div>
          <h1>Kotak masuk inventaris</h1>
          <p className="muted">Tinjau laporan ambil dan permintaan peminjaman anggota.</p>
        </div>
        <Link className="link-back" to="/inventaris">
          Kembali ke inventaris
        </Link>
      </div>

      <div className="card inventory-filters requests-filters">
        <label className="filter" htmlFor="inbox-tab">
          <span>Jenis permintaan</span>
          <select
            id="inbox-tab"
            disabled={saving}
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
          >
            <option value="komponen">Laporan ambil</option>
            <option value="pinjam">Permintaan pinjam</option>
          </select>
        </label>
      </div>

      {loadState === 'loading' && (
        <p className="muted" role="status">
          Memuat permintaan…
        </p>
      )}
      {loadState === 'error' && (
        <div className="card card-alert requests-message">
          <p className="error" role="alert">
            Permintaan gagal dimuat. Coba lagi.
          </p>
          <button
            type="button"
            onClick={() => {
              setLoadState('loading');
              setReloadKey((key) => key + 1);
            }}
          >
            Coba lagi
          </button>
        </div>
      )}
      {saving && <p role="status">Menyimpan keputusan…</p>}
      {notice && loadState === 'ready' && <p role="status">{notice}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {tab === 'komponen' && (
        <>
          <h2 className="requests-section-heading">Laporan ambil</h2>
          {loadState === 'ready' && visibleComponents.length === 0 && (
            <p className="card card-empty muted">Tidak ada laporan.</p>
          )}
          <ul className="cards requests-cards" aria-label="Laporan ambil">
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
                  <fieldset
                    className="requests-actions"
                    aria-label={`Tindakan ${row.itemName ?? 'Item terhapus'}`}
                    disabled={saving || loadState !== 'ready'}
                  >
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
                  </fieldset>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'pinjam' && (
        <>
          <h2 className="requests-section-heading">Permintaan pinjam</h2>
          {loadState === 'ready' && visibleLoans.length === 0 && (
            <p className="card card-empty muted">Tidak ada permintaan.</p>
          )}
          <ul className="cards requests-cards" aria-label="Permintaan pinjam">
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
                  <fieldset
                    className="requests-actions"
                    aria-label={`Tindakan ${row.itemName ?? 'Item terhapus'}`}
                    disabled={saving || loadState !== 'ready'}
                  >
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
                  </fieldset>
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
  onSubmit: (note: string) => Promise<boolean>;
}

function RejectForm({ onSubmit }: RejectFormProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const noteId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await onSubmit(note.trim())) {
      setOpen(false);
      setNote('');
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => setOpen(true)}>
        Tolak
      </button>
    );
  }

  return (
    <form className="inline-form requests-reject" onSubmit={submit} noValidate>
      <label htmlFor={noteId}>Alasan (opsional)</label>
      <input
        id={noteId}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
      />
      <button type="submit">Kirim penolakan</button>
    </form>
  );
}
