import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { apiFetch, ApiRequestError } from '../lib/api';
import { filterItems, itemBadge, type BadgeTone } from '../lib/inventory';
import type { ComponentRequest, InventoryItem, ItemStatus, LoanRequest, StockFlag } from '../types';

type FlagFilter = 'semua' | StockFlag | ItemStatus;

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: 'badge badge-ok',
  warn: 'badge badge-warn',
  bad: 'badge badge-bad',
  muted: 'badge',
};

export function InventoryPage() {
  const { profile } = useProfile();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [kind, setKind] = useState<'semua' | 'komponen' | 'barang'>('semua');
  const [flag, setFlag] = useState<FlagFilter>('semua');
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    apiFetch<InventoryItem[]>('/inventory')
      .then((list) => {
        if (!active) return;
        setItems(list);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = filterItems(items, { kind, flag, query });
  const canRequest = profile !== null && profile.role !== 'advisor';
  const hasFilters = kind !== 'semua' || flag !== 'semua' || query !== '';

  function clearFilters() {
    setKind('semua');
    setFlag('semua');
    setQuery('');
    searchInput.current?.focus();
  }

  return (
    <section className="inventory-page">
      <div className="page-head">
        <div>
          <h1>Inventaris</h1>
          <p className="muted">
            Lihat stok komponen dan ketersediaan barang sebelum mengajukan permintaan.
          </p>
        </div>
        <div className="inventory-actions">
          <Link className="link-back" to="/inventaris/permintaan-saya">
            Permintaan saya
          </Link>
          {profile?.role === 'admin' && (
            <>
              <Link className="link-back" to="/inventaris/kotak-masuk">
                Kotak masuk
              </Link>
              <Link className="link-back" to="/inventaris/baru">
                Tambah item
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="card inventory-filters">
        <label className="filter" htmlFor="cari-item">
          <span>Cari</span>
          <input
            id="cari-item"
            ref={searchInput}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nama item"
          />
        </label>

        <label className="filter" htmlFor="filter-jenis">
          <span>Jenis</span>
          <select
            id="filter-jenis"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option value="semua">Semua</option>
            <option value="komponen">Komponen</option>
            <option value="barang">Barang</option>
          </select>
        </label>

        <label className="filter" htmlFor="filter-status">
          <span>Status</span>
          <select
            id="filter-status"
            value={flag}
            onChange={(event) => setFlag(event.target.value as FlagFilter)}
          >
            <option value="semua">Semua</option>
            <option value="aman">AMAN</option>
            <option value="menipis">MENIPIS</option>
            <option value="habis">HABIS</option>
            <option value="tersedia">TERSEDIA</option>
            <option value="dipinjam">DIPINJAM</option>
          </select>
        </label>
      </div>

      {status === 'loading' && (
        <p className="card muted" role="status">
          Memuat inventaris…
        </p>
      )}
      {status === 'error' && (
        <p className="card error" role="alert">
          Inventaris gagal dimuat. Muat ulang halaman.
        </p>
      )}
      {status === 'ready' && (
        <div className="inventory-results">
          <p className="muted" role="status">
            Menampilkan {visible.length} dari {items.length} item.
          </p>
          {hasFilters && (
            <button type="button" className="link-back inventory-clear" onClick={clearFilters}>
              Hapus filter
            </button>
          )}
        </div>
      )}
      {status === 'ready' && items.length === 0 && (
        <div className="card inventory-empty">
          <h2>Inventaris belum tersedia.</h2>
          <p className="muted">Hubungi admin untuk menambahkan item inventaris.</p>
        </div>
      )}
      {status === 'ready' && items.length > 0 && visible.length === 0 && (
        <div className="card inventory-empty">
          <h2>Tidak ada item yang cocok dengan filter.</h2>
          <p className="muted">Ubah pencarian atau hapus filter untuk melihat semua item.</p>
        </div>
      )}

      <ul className="cards inventory-cards" aria-label="Daftar inventaris">
        {visible.map((item) => (
          <ItemCard key={item.id} item={item} canRequest={canRequest} />
        ))}
      </ul>
    </section>
  );
}

interface ItemCardProps {
  item: InventoryItem;
  canRequest: boolean;
}

function ItemCard({ item, canRequest }: ItemCardProps) {
  const badge = itemBadge(item);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setOpen((current) => !current);
    setError(null);
    setMessage(null);
  }

  return (
    <li className="card inventory-card">
      <div className="inventory-card-status">
        <span className="muted">{item.kind === 'komponen' ? 'Komponen' : 'Barang'}</span>
        <span className={TONE_CLASS[badge.tone]}>{badge.label}</span>
      </div>
      <h2>
        <Link className="item-link" to={`/inventaris/${item.id}`}>
          {item.name}
        </Link>
      </h2>
      <p className="muted">Kategori: {item.category}</p>
      {item.location && <p className="muted">Lokasi: {item.location}</p>}
      {item.kind === 'komponen' && (
        <p className="reservation-time">
          Stok {item.quantity}
          {item.minStock > 0 ? ` · minimum ${item.minStock}` : ''}
        </p>
      )}
      {item.kind === 'barang' && item.borrowerName && (
        <p className="muted">Dipinjam oleh {item.borrowerName}</p>
      )}

      {message && (
        <p className="hint" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {canRequest && item.kind === 'komponen' && (
        <>
          <button
            type="button"
            className="link-back"
            aria-expanded={open}
            onClick={toggle}
            disabled={item.quantity === 0}
          >
            Lapor ambil
          </button>
          {open && (
            <ComponentRequestForm
              item={item}
              onDone={(text) => {
                setOpen(false);
                setError(null);
                setMessage(text);
              }}
              onError={setError}
            />
          )}
        </>
      )}

      {canRequest && item.kind === 'barang' && item.status === 'tersedia' && (
        <>
          <button type="button" className="link-back" aria-expanded={open} onClick={toggle}>
            Ajukan pinjam
          </button>
          {open && (
            <LoanRequestForm
              item={item}
              onDone={(text) => {
                setOpen(false);
                setError(null);
                setMessage(text);
              }}
              onError={setError}
            />
          )}
        </>
      )}
    </li>
  );
}

interface RequestFormProps {
  item: InventoryItem;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

function ComponentRequestForm({ item, onDone, onError }: RequestFormProps) {
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch<ComponentRequest>('/component-requests', {
        method: 'POST',
        body: JSON.stringify({
          itemId: item.id,
          qty: Number(qty),
          note: note.trim() === '' ? undefined : note.trim(),
        }),
      });
      onDone('Laporan terkirim, menunggu konfirmasi admin.');
    } catch (err) {
      onError(err instanceof ApiRequestError ? err.message : 'Laporan gagal dikirim. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={onSubmit} noValidate>
      <label htmlFor={`qty-${item.id}`}>Jumlah</label>
      <input
        id={`qty-${item.id}`}
        type="number"
        min={1}
        max={item.quantity}
        value={qty}
        onChange={(event) => setQty(event.target.value)}
        required
      />

      <label htmlFor={`note-${item.id}`}>Catatan (opsional)</label>
      <input
        id={`note-${item.id}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
      />

      <button type="submit" disabled={submitting}>
        {submitting ? 'Mengirim…' : 'Kirim laporan'}
      </button>
    </form>
  );
}

function LoanRequestForm({ item, onDone, onError }: RequestFormProps) {
  const [purpose, setPurpose] = useState('');
  const [expectedReturnAt, setExpectedReturnAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch<LoanRequest>('/loan-requests', {
        method: 'POST',
        body: JSON.stringify({
          itemId: item.id,
          purpose: purpose.trim(),
          expectedReturnAt: expectedReturnAt === '' ? undefined : expectedReturnAt,
        }),
      });
      onDone('Permintaan terkirim, menunggu persetujuan admin.');
    } catch (err) {
      onError(
        err instanceof ApiRequestError ? err.message : 'Permintaan gagal dikirim. Coba lagi.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={onSubmit} noValidate>
      <label htmlFor={`purpose-${item.id}`}>Keperluan</label>
      <textarea
        id={`purpose-${item.id}`}
        value={purpose}
        onChange={(event) => setPurpose(event.target.value)}
        minLength={3}
        maxLength={500}
        rows={3}
        required
      />

      <label htmlFor={`return-${item.id}`}>Perkiraan kembali (opsional)</label>
      <input
        id={`return-${item.id}`}
        type="date"
        value={expectedReturnAt}
        onChange={(event) => setExpectedReturnAt(event.target.value)}
      />

      <button type="submit" disabled={submitting}>
        {submitting ? 'Mengirim…' : 'Kirim permintaan'}
      </button>
    </form>
  );
}
