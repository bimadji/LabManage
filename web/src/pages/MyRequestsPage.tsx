import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { apiFetch, ApiRequestError } from '../lib/api';
import { REQUEST_STATUS_LABEL, type BadgeTone } from '../lib/inventory';
import type { ComponentRequest, LoanRequest, RequestStatus } from '../types';

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

export function MyRequestsPage() {
  const { profile } = useProfile();
  const [components, setComponents] = useState<ComponentRequest[]>([]);
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
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
        // Admin melihat riwayat semua; anggota dan advisor hanya milik sendiri.
        // RLS mengizinkan advisor membaca semua baris untuk Kotak masuk, jadi filter di klien.
        const own = (userId: string) => profile?.role === 'admin' || userId === profile?.id;
        setComponents(componentList.filter((row) => own(row.userId)));
        setLoans(loanList.filter((row) => own(row.userId)));
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [reloadKey, profile]);

  async function cancel(request: LoanRequest) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await apiFetch<LoanRequest>(`/loan-requests/${request.id}/cancel`, { method: 'PATCH' });
      setStatus('loading');
      setReloadKey((key) => key + 1);
      setNotice('Permintaan berhasil dibatalkan.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Pembatalan gagal. Coba lagi.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="inventory-requests-page">
      <div className="page-head">
        <div>
          <h1>Permintaan saya</h1>
          <p className="muted">Pantau laporan ambil dan status peminjaman Anda.</p>
        </div>
        <Link className="link-back" to="/inventaris">
          Kembali ke inventaris
        </Link>
      </div>

      {status === 'loading' && (
        <p className="muted" role="status">
          Memuat permintaan…
        </p>
      )}
      {status === 'error' && (
        <div className="card card-alert requests-message">
          <p className="error" role="alert">
            Permintaan gagal dimuat. Coba lagi.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus('loading');
              setReloadKey((key) => key + 1);
            }}
          >
            Coba lagi
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saving && <p role="status">Membatalkan permintaan…</p>}
      {notice && status === 'ready' && <p role="status">{notice}</p>}

      <h2 className="requests-section-heading">Laporan ambil</h2>
      {status === 'ready' && components.length === 0 && (
        <p className="card card-empty muted">Belum ada laporan.</p>
      )}
      <ul className="cards requests-cards" aria-label="Laporan ambil">
        {components.map((request) => (
          <li key={request.id} className="card">
            <p className="reservation-room">{request.itemName ?? 'Item terhapus'}</p>
            <p className="reservation-time">Jumlah {request.qty}</p>
            {request.note && <p className="muted">{request.note}</p>}
            <span className={TONE_CLASS[STATUS_TONE[request.status]]}>
              {REQUEST_STATUS_LABEL[request.status]}
            </span>
            {request.adminNote && <p className="muted">Catatan admin: {request.adminNote}</p>}
          </li>
        ))}
      </ul>

      <h2 className="requests-section-heading">Permintaan pinjam</h2>
      {status === 'ready' && loans.length === 0 && (
        <p className="card card-empty muted">Belum ada permintaan.</p>
      )}
      <ul className="cards requests-cards" aria-label="Permintaan pinjam">
        {loans.map((request) => (
          <li key={request.id} className="card">
            <p className="reservation-room">{request.itemName ?? 'Item terhapus'}</p>
            <p className="muted">{request.purpose}</p>
            {request.expectedReturnAt && (
              <p className="muted">Perkiraan kembali {request.expectedReturnAt}</p>
            )}
            <span className={TONE_CLASS[STATUS_TONE[request.status]]}>
              {REQUEST_STATUS_LABEL[request.status]}
            </span>
            {request.adminNote && <p className="muted">Catatan admin: {request.adminNote}</p>}
            {request.status === 'menunggu' && (
              <div className="requests-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={saving || status !== 'ready'}
                  onClick={() => void cancel(request)}
                >
                  Batalkan
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
