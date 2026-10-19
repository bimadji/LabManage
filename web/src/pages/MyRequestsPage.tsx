import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [components, setComponents] = useState<ComponentRequest[]>([]);
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
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
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function cancel(request: LoanRequest) {
    setError(null);
    try {
      await apiFetch<LoanRequest>(`/loan-requests/${request.id}/cancel`, { method: 'PATCH' });
      setStatus('loading');
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Pembatalan gagal. Coba lagi.');
    }
  }

  return (
    <section>
      <div className="page-head">
        <h1>Permintaan saya</h1>
        <Link className="link-back" to="/inventaris">
          Kembali ke inventaris
        </Link>
      </div>

      {status === 'loading' && <p className="muted">Memuat permintaan…</p>}
      {status === 'error' && (
        <p className="error" role="alert">
          Permintaan gagal dimuat. Muat ulang halaman.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <h2>Laporan ambil</h2>
      {status === 'ready' && components.length === 0 && <p className="muted">Belum ada laporan.</p>}
      <ul className="cards">
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

      <h2>Permintaan pinjam</h2>
      {status === 'ready' && loans.length === 0 && <p className="muted">Belum ada permintaan.</p>}
      <ul className="cards">
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
              <button type="button" className="link-back" onClick={() => void cancel(request)}>
                Batalkan
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
